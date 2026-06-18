// ClauseGuard LLM Backend — provider-agnostische legal-style proxy naar OpenRouter.
// Verwerkt contracttekst in batch en stuurt gestructureerde stijl/grammatica-issues terug.

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

// Laad .env uit de server-map zelf, ongeacht de huidige werkmap. Zo pakt zowel
// `cd server && node index.js` als `node server/index.js` (vanuit de repo-root) de juiste .env.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/** Bouwt de system prompt voor de bredere NL/EN proeflezer. */
function buildSystemPrompt() {
  return `You are a meticulous bilingual (Dutch/English) proofreader. You review document text — both legal contracts and general prose — and return structured issues.

Report ONLY these categories. Be EQUALLY thorough across all four: vague/wordy style and self-contradictory statements matter just as much as grammar and facts — do NOT under-report "style" and "consistency".
- "grammar": agreement errors (subject-verb), Dutch d/t verb endings (e.g. "veranderd" vs "verandert"), wrong verb/word forms, word order, wrong word choice (e.g. "hun" vs "hen"), a REAL word used in the wrong form (e.g. a finite verb where a plural noun is meant: "presteren op toetsten" -> "toetsen"), and incomplete determiner/pronoun forms (e.g. "bijna alle" -> "bijna alles"). These can look like spelling but are grammar — DO report them.
- "style": vague, wordy, hedging or empty phrasing that makes no real claim (e.g. "maar ook niet echt want sommige mensen vinden het wel oké eigenlijk", or an understatement like 'wat experts "een beetje warm" noemen' for something extreme); redundancy/pleonasms (e.g. "eveneens ook", a needless "tegelijkertijd"); legally uncertain undefined terms ("reasonable", "promptly", "as soon as possible"); inconsistent modal verbs in contracts ("shall" vs "will").
- "consistency": internal contradictions or illogic you can detect FROM THE TEXT ITSELF, without outside knowledge — e.g. a statement that affirms and denies at once ("zowel goed als slecht ... afhankelijk van hoe je er naar kijkt of niet"), one that covers every outcome and so says nothing ("als iedereen dit doet of niet doet, wordt de wereld beter of slechter"), or a conclusion that contradicts what the same passage describes (e.g. polar bears being "heel blij" with the warming the text frames as harmful).
- "factual": a claim that requires external world knowledge and appears false (wrong inventor, wrong date, wrong geography, fabricated quote). FLAG ONLY — see the suggestion rule.

Do NOT report:
- Pure spelling of non-existent words (a separate offline dictionary handles those).
- Correct, clear text that you would only change for personal taste.

Rules for every issue:
- "original": the SMALLEST changed span, copied VERBATIM from the paragraph (exact characters, including any quote marks). Keep it minimal — for "presteren op toetsten" the original is "op toetsten" (or just "toetsten"), NOT the whole clause. For "style"/"consistency"/"factual" the span may be the relevant phrase, but never longer than needed.
- "suggestion": for "grammar", the corrected span. For "style"/"consistency", an improved short rewrite IF there is a clear one, otherwise set "suggestion" to "" (flag only — the explanation carries the point). For "factual", ALWAYS set "suggestion" to "" — never assert a corrected fact (you could be wrong); put what seems off in the explanation instead.
- "category": one of "grammar" | "style" | "consistency" | "factual".
- "explanation": ONE short sentence, in the SAME language as the fragment (Dutch for Dutch text, English for English). For "factual", begin it with "Lijkt feitelijk onjuist — controleer:" (NL) or "Looks factually wrong — verify:" (EN).
- "confidence": a number between 0 and 1. Only include an issue when confidence >= 0.6. For "factual", only flag when you are fairly sure the claim is wrong.

You MUST respond with ONLY valid JSON in exactly this structure — no prose, no markdown fences, no reasoning:
{
  "issues": [
    {
      "paragraphIndex": <number — the 0-based [index] shown before the paragraph>,
      "original": "<exact substring, copied verbatim>",
      "suggestion": "<corrected span, or \"\" for factual>",
      "category": "<grammar|style|consistency|factual>",
      "explanation": "<short, same language as the fragment>",
      "confidence": <number between 0 and 1>
    }
  ]
}

Illustrative example (do not copy verbatim — note style/consistency here have an empty suggestion):
{"issues":[
 {"paragraphIndex":0,"original":"technologie hebben","suggestion":"technologie heeft","category":"grammar","explanation":"Onderwerp 'technologie' is enkelvoud, dus 'heeft'.","confidence":0.97},
 {"paragraphIndex":2,"original":"maar ook niet echt want sommige mensen vinden het wel oké eigenlijk","suggestion":"","category":"style","explanation":"Zwabberende, vage formulering zonder duidelijk standpunt.","confidence":0.82},
 {"paragraphIndex":3,"original":"zowel goed als slecht is, afhankelijk van hoe je er naar kijkt of niet","suggestion":"","category":"consistency","explanation":"Bevestigt en ontkent tegelijk — de bewering zegt niets.","confidence":0.85},
 {"paragraphIndex":0,"original":"uitgevonden door Bill Gates","suggestion":"","category":"factual","explanation":"Lijkt feitelijk onjuist — controleer: de iPhone werd door Apple onder Steve Jobs ontwikkeld.","confidence":0.9}
]}

If no issues are found, return { "issues": [] }. Respond ONLY with the JSON object — nothing else.`;
}

/**
 * Bouwt de user-prompt door alle paragrafen als genummerde lijst aan te bieden.
 * @param {Array<{index: number, text: string}>} paragraphs
 */
function buildUserPrompt(paragraphs) {
  const lines = paragraphs
    .filter((p) => p.text && p.text.trim().length > 0)
    .map((p) => `[${p.index}] ${p.text}`)
    .join("\n");

  return `Review the following document paragraphs and report ALL grammar, style, consistency and factual issues per the rules. The text may be a contract or general prose — do not assume it is a contract.\n\n${lines}`;
}

/**
 * Valideert en normaliseert een issue-object uit de LLM-response defensief.
 * @param {unknown} item
 * @returns {{ valid: boolean, issue?: object }}
 */
function validateIssueItem(item) {
  if (!item || typeof item !== "object") return { valid: false };

  const i = /** @type {Record<string, unknown>} */ (item);

  const categoryOk = ["grammar", "style", "consistency", "factual"].includes(
    /** @type {string} */ (i.category)
  );

  if (
    typeof i.paragraphIndex !== "number" ||
    typeof i.original !== "string" ||
    !i.original.trim() ||
    !categoryOk ||
    typeof i.explanation !== "string"
  ) {
    return { valid: false };
  }

  // Suggestie-regel: factual krijgt NOOIT een suggestie (geen feit autocorrigeren). De andere
  // categorieën MOGEN zonder suggestie (lege string → flag-only advies, bv. een vage stijl- of
  // tegenstrijdigheids-bevinding zonder schone herschrijving); mét suggestie worden ze een redline.
  const suggestion =
    i.category === "factual" ? "" : typeof i.suggestion === "string" ? i.suggestion : "";

  return {
    valid: true,
    issue: {
      paragraphIndex: i.paragraphIndex,
      original: i.original,
      suggestion,
      category: i.category,
      explanation: i.explanation,
      confidence: typeof i.confidence === "number" ? Math.max(0, Math.min(1, i.confidence)) : 0.8,
    },
  };
}

/**
 * POST /api/legal-style
 * Body: { paragraphs: {index: number, text: string}[], useLlm?: boolean }
 * Response: { issues: ValidatedIssue[] } | { issues: [], error: string }
 */
app.post("/api/legal-style", async (req, res) => {
  const { paragraphs, useLlm } = req.body ?? {};

  // Geen key of LLM expliciet uitgeschakeld → lege lijst teruggeven (offline mode)
  if (!OPENROUTER_API_KEY || useLlm === false) {
    return res.json({ issues: [] });
  }

  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return res.json({ issues: [] });
  }

  // Hard timeout: een trage of hangende provider mag het verzoek niet eindeloos laten hangen.
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 25000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        // response_format zorgt voor betrouwbare JSON-output (ondersteund door de meeste OpenRouter-modellen)
        response_format: { type: "json_object" },
        // reasoning uitschakelen via OpenRouter's unified veld (werkt voor Gemini én Claude),
        // zodat de JSON direct in message.content staat i.p.v. achter reasoning-tokens.
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(paragraphs) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown upstream error");
      console.error(`[clauseguard] OpenRouter HTTP ${response.status}: ${errText}`);
      return res.json({ issues: [], error: `Upstream error ${response.status}` });
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    if (typeof rawContent !== "string") {
      return res.json({ issues: [], error: "Geen content in LLM-response" });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Sommige modellen sturen toch markdown-fences; probeer te strippen
      const stripped = rawContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      try {
        parsed = JSON.parse(stripped);
      } catch {
        console.error("[clauseguard] JSON parse mislukt:", rawContent.slice(0, 200));
        return res.json({ issues: [], error: "Ongeldige JSON van model" });
      }
    }

    const rawIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const issues = rawIssues
      .map((item) => validateIssueItem(item))
      .filter((r) => r.valid)
      .map((r) => r.issue);

    return res.json({ issues });
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    const message = aborted ? "Upstream timeout" : err instanceof Error ? err.message : String(err);
    console.error("[clauseguard] Onverwachte fout:", message);
    // Nooit crashen; de add-in degradeert gracefully naar offline mode
    return res.json({ issues: [], error: message });
  } finally {
    clearTimeout(timeoutId);
  }
});

/**
 * GET /api/health
 * Eenvoudige heartbeat voor de add-in om te controleren of de backend bereikbaar is.
 */
app.get("/api/health", (_req, res) => {
  // hasKey laat de add-in onderscheiden tussen "draait én geconfigureerd" en
  // "draait maar zonder key" (waarbij elke scan structureel leeg blijft).
  res.json({ ok: true, model: MODEL, hasKey: Boolean(OPENROUTER_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`[clauseguard] Backend actief op http://localhost:${PORT} (model: ${MODEL})`);
});
