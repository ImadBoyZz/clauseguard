// ClauseGuard — LLM legal-style client.
// Stuurt paragrafen naar de lokale backend-proxy en mapt de response naar Issue-objecten.
// Bij elke fout wordt graceful [] teruggegeven zodat de add-in niet crasht.

/* global console, fetch */

import { Issue, DocParagraph, IssueCategory, severityForCategory, AiStatus } from "./types";

/** Beperkt een ruwe confidence tot een geldige [0,1]-waarde (of undefined bij onzin/NaN). */
function clampConfidence(raw: unknown): number | undefined {
  return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw as number)) : undefined;
}

/**
 * Minimale betrouwbaarheid waaronder we een LLM-issue NIET tonen (recall vs. ruis).
 * ~0.6 = gebalanceerd: duidelijke fouten komen door, smaak-nitpicks vallen weg.
 */
const CONFIDENCE_THRESHOLD = 0.6;

/** Categorieën die de LLM-laag mag aanleveren (spelling komt van de offline nspell-engine). */
const LLM_CATEGORIES: IssueCategory[] = ["grammar", "style"];

/**
 * PER-PARAGRAAF sessie-cache: de issues van EEN paragraaf worden gecachet op een hash van
 * (paragraafindex + tekst). Zo verandert het wijzigen van een paragraaf alleen die paragraaf z'n
 * sleutel - alle ongewijzigde paragrafen komen identiek uit de cache en gaan NIET opnieuw naar het
 * model. Dat lost twee dingen op: (1) een letter aanpassen her-rolt niet meer de issues van het
 * hele document (Sonnet is bij temperature 0 niet bit-deterministisch, dus een volledige herscan
 * wobbelt), en (2) het scheelt API-calls/kosten - alleen de gewijzigde paragraaf wordt verstuurd.
 * Module-scoped: leeft per sessie en wist zich bij een herlaad van het paneel.
 */
const paraCache = new Map<string, Issue[]>();

/** djb2-hash van (useLlm + paragraafindex + tekst) — de per-paragraaf cache-sleutel. */
function paraKey(useLlm: boolean, p: DocParagraph): string {
  let h = 5381;
  const s = (useLlm ? "1" : "0") + " " + p.index + " " + p.text;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Raw issue-object zoals de backend het teruggeeft (vóór mapping naar Issue). */
interface BackendIssueRaw {
  paragraphIndex: number;
  original: string;
  suggestion: string;
  category: string;
  explanation: string;
  confidence?: number;
}

/** Response-envelop van POST /api/legal-style. */
interface BackendResponse {
  issues: BackendIssueRaw[];
  error?: string;
}

/** Defensieve validatie + confidence-drempel voor één backend-issue. */
function isValidRaw(item: BackendIssueRaw): boolean {
  if (
    typeof item.paragraphIndex !== "number" ||
    typeof item.original !== "string" ||
    item.original.trim().length === 0 ||
    !LLM_CATEGORIES.includes(item.category as IssueCategory)
  ) {
    return false;
  }
  // Ontbrekende/onzin-confidence (NaN, >1) telt als zeker genoeg (0.8 fallback, gelijk aan de
  // server-default) zodat we geen geldige issues wegfilteren.
  const conf = clampConfidence(item.confidence) ?? 0.8;
  return conf >= CONFIDENCE_THRESHOLD;
}

/** Mapt één gevalideerd backend-issue naar een Issue (id/occurrence zet runChecks later). */
function mapRawToIssue(item: BackendIssueRaw, idx: number): Issue {
  const category = item.category as IssueCategory;
  return {
    // Tijdelijk id — runChecks.ts overschrijft dit met een stabiele versie
    id: `llm-${item.paragraphIndex}-${idx}-${item.original.slice(0, 16)}`,
    category,
    severity: severityForCategory(category),
    original: item.original,
    // style-adviezen mogen zonder suggestie komen (alleen markeren); lege string → undefined
    suggestion: item.suggestion || undefined,
    explanation: item.explanation,
    confidence: clampConfidence(item.confidence),
    paragraphIndex: item.paragraphIndex,
    // occurrence wordt door runChecks.ts herberekend over het hele document
    occurrence: 0,
    status: "pending",
    source: "llm",
  };
}

/**
 * Controleert of de legal-style functionaliteit beschikbaar is.
 * De backend beslist zelf of de OPENROUTER_API_KEY aanwezig is;
 * vanuit de client is het proxy-pad "/api" altijd bereikbaar (same-origin).
 */
export function isLegalStyleConfigured(): boolean {
  return true;
}

/**
 * Stuurt de NOG NIET gecachete paragrafen naar de LLM-backend en assembleert het resultaat
 * per-paragraaf uit de cache. Geeft [] terug als useLlm false is. Bij een netwerk-/parse-fout
 * geven we de al-gecachete paragrafen wél terug; de mislukte paragrafen blijven ongecachet en
 * worden bij een volgende scan opnieuw geprobeerd (graceful degradation).
 *
 * @param paragraphs - Paragrafen uit het Word-document
 * @param useLlm     - False = sla de LLM-aanroep volledig over (offline mode)
 */
export async function checkLegalStyle(
  paragraphs: DocParagraph[],
  useLlm: boolean
): Promise<Issue[]> {
  if (!useLlm) return [];

  // Bepaal per paragraaf de cache-sleutel en welke paragrafen nog niet gecachet zijn.
  // Alleen die niet-gecachete paragrafen sturen we naar het model.
  const keys = paragraphs.map((p) => paraKey(useLlm, p));
  const toScan: DocParagraph[] = [];
  paragraphs.forEach((p, i) => {
    if (!paraCache.has(keys[i])) toScan.push(p);
  });

  if (toScan.length > 0) {
    let data: BackendResponse | null = null;

    try {
      const response = await fetch("/api/legal-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraphs: toScan, useLlm }),
      });
      if (response.ok) {
        data = (await response.json()) as BackendResponse;
      }
    } catch {
      // Netwerk-/parse-fout (backend niet bereikbaar, timeout, etc.): niets cachen, de
      // niet-gecachete paragrafen worden bij de volgende scan opnieuw geprobeerd.
      data = null;
    }

    // De backend degradeert bij een upstream-fout naar { issues: [], error }. Log dat, zodat een
    // stille leegte herleidbaar is i.p.v. als "geen issues" gelezen te worden.
    if (data?.error) {
      console.warn("ClauseGuard AI-laag: backend meldde een upstream-fout:", data.error);
    }

    // Alleen bij een geslaagde respons ZONDER upstream-fout cachen we per paragraaf — ook lege
    // sets, zodat een schone paragraaf niet elke scan opnieuw bevraagd wordt.
    if (data && !data.error && Array.isArray(data.issues)) {
      const fresh = data.issues.filter(isValidRaw).map(mapRawToIssue);
      const byPara = new Map<number, Issue[]>();
      for (const p of toScan) byPara.set(p.index, []);
      for (const iss of fresh) {
        const bucket = byPara.get(iss.paragraphIndex);
        if (bucket) bucket.push(iss);
      }
      paragraphs.forEach((p, i) => {
        const bucket = byPara.get(p.index);
        if (bucket) paraCache.set(keys[i], bucket);
      });
    }
  }

  // Stel het resultaat samen uit de cache, in documentvolgorde. Verse kopieën, zodat de downstream
  // id/occurrence-toekenning in runChecks de gecachete objecten niet muteert.
  const out: Issue[] = [];
  keys.forEach((key) => {
    const cached = paraCache.get(key);
    if (cached) {
      for (const iss of cached) out.push({ ...iss });
    }
  });
  return out;
}

/**
 * Pingt de backend-heartbeat (GET /api/health) en vertaalt het naar een AiStatus.
 * Onderscheidt expliciet "draait maar geen key" (nokey) van "niet bereikbaar" (offline),
 * zodat de UI niet "AI bereikbaar" toont terwijl elke scan structureel leeg blijft.
 */
export async function checkAiHealth(): Promise<AiStatus> {
  try {
    const response = await fetch("/api/health", { method: "GET" });
    if (!response.ok) return "offline";
    const data = (await response.json()) as { ok?: boolean; hasKey?: boolean };
    if (data?.ok !== true) return "offline";
    return data.hasKey ? "ok" : "nokey";
  } catch {
    return "offline";
  }
}
