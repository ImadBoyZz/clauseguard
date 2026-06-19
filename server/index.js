// ClauseGuard LLM Backend — provider-agnostische proeflezer-proxy naar OpenRouter.
// Verwerkt documenttekst in batch en stuurt gestructureerde grammatica/stijl-issues terug.

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

/** Bouwt de system prompt voor de bilinguale NL/EN taalproeflezer (grammatica + stijl). */
function buildSystemPrompt() {
  return `You are a meticulous bilingual (Dutch/English) proofreader. You review document text — both legal contracts and general prose — and return structured LANGUAGE issues only.

Report ONLY these two categories. Be thorough across BOTH: weak/wordy style and clumsy sentence structure matter just as much as grammar — do NOT under-report "style".
- "grammar": agreement errors (subject-verb), Dutch d/t verb endings (e.g. "veranderd" vs "verandert"), wrong verb/word forms, word order, wrong word choice (e.g. "hun" vs "hen"), a REAL word used in the wrong form (e.g. a finite verb where a plural noun is meant: "presteren op toetsten" -> "toetsen"), and incomplete determiner/pronoun forms (e.g. "bijna alle" -> "bijna alles"). These can look like spelling but are grammar — DO report them. CRUCIALLY, also catch REAL-WORD ERRORS: a correctly-spelled word that is clearly the WRONG word in this context — a typo or mix-up that happens to land on another existing word. The offline dictionary CANNOT flag these (both words exist), so it is YOUR job. Examples (EN): "a calendar year ... three hundred and fifty dais" -> "days"; "their"/"there"/"they're"; "its"/"it's"; "form"/"from"; "lose"/"loose"; "to"/"too". Examples (NL): "een"/"en"; "dan"/"dat"; "me"/"mij". Report each under "grammar" with the word the writer clearly meant as the suggestion.
- "style": vague, wordy, hedging or empty phrasing (e.g. "maar ook niet echt want sommige mensen vinden het wel oké eigenlijk"); redundancy/pleonasms (e.g. "eveneens ook", a needless "tegelijkertijd"); awkward sentence structure or word order that reads poorly (zinsbouw); weak, imprecise or clumsy word choice (vocabulaire); legally uncertain undefined terms ("reasonable", "promptly", "as soon as possible"); inconsistent modal verbs in contracts ("shall" vs "will").

Do NOT report:
- Pure spelling of non-existent words (a separate offline dictionary handles those).
- Judge every span IN ISOLATION — using ONLY the words inside that span and ordinary language sense. If you can tell it is "wrong" ONLY by comparing it to a DIFFERENT sentence or paragraph, or by using FACTS about the world, it is OUT OF SCOPE: do NOT output it under "grammar" OR "style", not even with low confidence. Concretely you MUST NOT: flag a clause because it conflicts with another article (e.g. one says "dertig dagen" and another "zestig dagen"); flag a number, date or statement because it is factually wrong (e.g. "een kalenderjaar heeft 365 dagen, niet 350", or "de iPhone kwam uit in 2007"); flag any internal contradiction. Only report problems VISIBLE FROM THE SPAN ITSELF: spelling-like grammar, agreement, verb forms, word order, wordiness, vagueness, redundancy, clumsy phrasing, weak word choice. EXCEPTION — a wrong-but-existing WORD (a real-word error such as "fifty dais" -> "days") IS in scope and you MUST still report it under "grammar", even when the SAME sentence also holds an out-of-scope factual claim: the wrong word is a plain language slip you can see from the span itself, separate from the factual claim (only the bare fact, e.g. the exact number, stays out of scope).
- Correct, clear text that you would only change for personal taste.

Rules for every issue:
- "original": the SMALLEST changed span, copied VERBATIM from the paragraph (exact characters, including any quote marks). Keep it minimal — for "presteren op toetsten" the original is "op toetsten" (or just "toetsten"), NOT the whole clause. For "style" the span may be the relevant phrase, but never longer than needed. Trim it to exactly the words your "suggestion" changes: do NOT wrap a long run of unchanged words around a tiny edit. If only one word changes, "original" is that one word. Copy the span EXACTLY as it appears in the paragraph, character for character — INCLUDING any spelling mistakes inside it. If the paragraph reads "betalign", write "betalign", never the corrected "betaling". Silently fixing a typo inside "original" makes the span impossible to find in the document, so its correction and comment can never be applied.
- "suggestion": ALWAYS provide a concrete drop-in replacement for the "original" span — for BOTH "grammar" and "style". It must fit straight into the sentence so the user can accept it directly as a tracked change. For "style", give the tightest clear rewrite: remove the redundancy, tighten the wording, or replace a vague term with a more concrete formulation (use a sensible placeholder such as "dertig (30) dagen" when an exact value is unknown). NEVER leave "suggestion" empty and never merely restate the original unchanged. The difference between "original" and "suggestion" MUST be exactly the fix your "explanation" describes — nothing else. Never return a "suggestion" that equals the "original" except for some UNRELATED change (e.g. silently correcting a stray spelling typo while your explanation talks about "will" vs "shall"). Concrete BAD example to avoid: original "will protect all Confidential Data and shall recieve" -> suggestion "will protect all Confidential Data and shall receive" with an explanation about will/shall — there the only real change is a spelling fix the explanation never mentions. Instead either pick the smallest span your fix actually changes (e.g. original "shall receive" -> suggestion "will receive" to make the verbs consistent), or omit the issue entirely.
- "category": one of "grammar" | "style".
- "explanation": ONE short sentence, in the SAME language as the fragment (Dutch for Dutch text, English for English). Write it in plain, everyday language a 10-year-old could understand: explain in ordinary words WHY the text reads wrong (the effect), never by naming the grammatical category. NEVER use grammar or linguistic jargon, in ANY grammatical form (singular, plural or inflected — e.g. neither "modaal werkwoord" NOR "modale werkwoorden"). Avoid words such as — Dutch: "pleonasme", "tautologie", "onderwerp", "persoonsvorm", "lijdend/meewerkend voorwerp", "enkelvoud", "meervoud", "voltooid deelwoord", "d/t-regel", "bijvoeglijk/zelfstandig naamwoord", "bijwoord", "lidwoord", "voorzetsel", "modaal werkwoord", "congruentie", "redundantie"; English: "pleonasm", "tautology", "subject", "predicate", "subject-verb agreement", "finite verb", "modal verb", "determiner", "pronoun", "adverb", "adjective", "noun", "redundancy", "agreement", "conjugation". For example, instead of "Pleonasme: 'eveneens' en 'ook' betekenen hetzelfde." write "'eveneens' en 'ook' betekenen hetzelfde, dus dubbelop."; instead of "Onderwerp 'technologie' is enkelvoud, dus 'heeft'." write "Het gaat over één ding, dus hier hoort 'heeft'."
- "confidence": a number between 0 and 1. Only include an issue when confidence >= 0.6.

You MUST respond with ONLY valid JSON in exactly this structure — no prose, no markdown fences, no reasoning:
{
  "issues": [
    {
      "paragraphIndex": <number — the 0-based [index] shown before the paragraph>,
      "original": "<exact substring, copied verbatim>",
      "suggestion": "<concrete drop-in replacement for the original span>",
      "category": "<grammar|style>",
      "explanation": "<short, same language as the fragment>",
      "confidence": <number between 0 and 1>
    }
  ]
}

Illustrative example (do not copy verbatim — note every issue has a concrete drop-in suggestion):
{"issues":[
 {"paragraphIndex":0,"original":"technologie hebben","suggestion":"technologie heeft","category":"grammar","explanation":"Het gaat over één ding, dus hier hoort 'heeft'.","confidence":0.97},
 {"paragraphIndex":2,"original":"eveneens ook van toepassing","suggestion":"eveneens van toepassing","category":"style","explanation":"'eveneens' en 'ook' betekenen hetzelfde, dus dubbelop.","confidence":0.9}
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

  return `Review the following document paragraphs and report grammar and style issues per the rules. The text may be a contract or general prose — do not assume it is a contract.\n\n${lines}`;
}

/**
 * Valideert en normaliseert een issue-object uit de LLM-response defensief.
 * @param {unknown} item
 * @returns {{ valid: boolean, issue?: object }}
 */
function validateIssueItem(item) {
  if (!item || typeof item !== "object") return { valid: false };

  const i = /** @type {Record<string, unknown>} */ (item);

  const categoryOk = ["grammar", "style"].includes(/** @type {string} */ (i.category));

  if (
    typeof i.paragraphIndex !== "number" ||
    typeof i.original !== "string" ||
    !i.original.trim() ||
    !categoryOk ||
    typeof i.explanation !== "string"
  ) {
    return { valid: false };
  }

  // Suggestie: de prompt vraagt nu voor zowel "grammar" als "style" altijd een concrete drop-in
  // vervanging (zie buildSystemPrompt). Geeft het model er toch geen, dan laten we de lege string
  // door als zachte fallback — de client toont het issue dan flag-only i.p.v. het weg te gooien.
  // Mét suggestie wordt het een redline in het document.
  const suggestion = typeof i.suggestion === "string" ? i.suggestion : "";

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
  console.log(
    `[clauseguard] /api/legal-style: ${Array.isArray(paragraphs) ? paragraphs.length : 0} paragraaf/paragrafen ontvangen`
  );

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
        // Deterministische sampling: temperature 0 + een vaste seed, zodat een herscan van hetzelfde
        // document niet de ene keer 9 en de andere keer 10 issues geeft. De provider kan nog minieme
        // ruis houden (MoE-routing / floating point), maar de ±1-flapping verdwijnt in de praktijk.
        temperature: 0,
        seed: 7,
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

/** System prompt voor de spelling-rerank: kies per woord de zin-passende kandidaat (geen nieuwe woorden). */
function buildRerankSystemPrompt() {
  return `You are a bilingual (Dutch/English) proofreader. For each item you receive a MISSPELLED word, the SENTENCE it appears in, and a list of CANDIDATE corrections from a spell-checker. Pick, for each item, the single candidate that best fits the sentence grammatically and in meaning.

Hard rules:
- The chosen "suggestion" MUST be EXACTLY one of THAT item's candidates — copy it verbatim, character for character. NEVER invent a new word or alter a candidate.
- Use the surrounding words to disambiguate. Example: in "The partiec agree that ... neither party" the verb "agree" and "party" make "parties" correct, not "partied".
- If no candidate clearly fits, return that item's FIRST candidate unchanged.

Respond with ONLY valid JSON in exactly this shape — no prose, no markdown fences:
{ "picks": [ { "id": "<the item id>", "suggestion": "<one of that item's candidates>" } ] }`;
}

/** User-prompt: de te herrangschikken items, elk met woord, zin en kandidaten. */
function buildRerankUserPrompt(items) {
  const lines = items.map((it) => {
    const cands = Array.isArray(it.candidates) ? it.candidates.join(" | ") : "";
    return `id ${it.id}: word="${it.word}" | sentence="${it.context}" | candidates=[ ${cands} ]`;
  });
  return `Pick the best candidate for each item:\n\n${lines.join("\n")}`;
}

/**
 * POST /api/spell-rerank
 * Body: { items: { id: string, word: string, context: string, candidates: string[] }[] }
 * Response: { picks: { id: string, suggestion: string }[] } | { picks: [], error: string }
 *
 * Kiest per offline spelfout de contextueel beste correctie uit de aangeleverde kandidaten.
 * Verandert NOOIT het aantal fouten — alleen WELKE correctie wordt voorgesteld. Faalt nooit hard:
 * zonder key/zonder items of bij een upstream-fout komt { picks: [] } terug (offline gok blijft staan).
 */
app.post("/api/spell-rerank", async (req, res) => {
  const { items } = req.body ?? {};
  console.log(
    `[clauseguard] /api/spell-rerank: ${Array.isArray(items) ? items.length : 0} woord(en) ontvangen`
  );

  if (!OPENROUTER_API_KEY || !Array.isArray(items) || items.length === 0) {
    return res.json({ picks: [] });
  }

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
        temperature: 0,
        seed: 7,
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: buildRerankSystemPrompt() },
          { role: "user", content: buildRerankUserPrompt(items) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown upstream error");
      console.error(`[clauseguard] spell-rerank OpenRouter HTTP ${response.status}: ${errText}`);
      return res.json({ picks: [], error: `Upstream error ${response.status}` });
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return res.json({ picks: [], error: "Geen content in LLM-response" });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const stripped = rawContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      try {
        parsed = JSON.parse(stripped);
      } catch {
        console.error("[clauseguard] spell-rerank JSON parse mislukt:", rawContent.slice(0, 200));
        return res.json({ picks: [], error: "Ongeldige JSON van model" });
      }
    }

    const rawPicks = Array.isArray(parsed?.picks) ? parsed.picks : [];
    const picks = rawPicks
      .filter((p) => p && p.id !== undefined && typeof p.suggestion === "string" && p.suggestion)
      .map((p) => ({ id: String(p.id), suggestion: p.suggestion }));

    return res.json({ picks });
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    const message = aborted ? "Upstream timeout" : err instanceof Error ? err.message : String(err);
    console.error("[clauseguard] spell-rerank onverwachte fout:", message);
    return res.json({ picks: [], error: message });
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
