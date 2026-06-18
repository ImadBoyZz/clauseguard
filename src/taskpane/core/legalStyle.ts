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

/** Categorieën die de LLM-laag mag aanleveren (de rest komt van de offline engines). */
const LLM_CATEGORIES: IssueCategory[] = ["grammar", "style", "consistency", "factual"];

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

/**
 * Controleert of de legal-style functionaliteit beschikbaar is.
 * De backend beslist zelf of de OPENROUTER_API_KEY aanwezig is;
 * vanuit de client is het proxy-pad "/api" altijd bereikbaar (same-origin).
 */
export function isLegalStyleConfigured(): boolean {
  return true;
}

/**
 * Stuurt paragrafen naar de LLM-backend en geeft een lijst van stijl/grammatica-issues terug.
 * Geeft [] terug als useLlm false is, of bij elke netwerk- of parse-fout.
 *
 * @param paragraphs - Paragrafen uit het Word-document
 * @param useLlm     - False = sla de LLM-aanroep volledig over (offline mode)
 */
export async function checkLegalStyle(
  paragraphs: DocParagraph[],
  useLlm: boolean
): Promise<Issue[]> {
  if (!useLlm) return [];

  let data: BackendResponse;

  try {
    const response = await fetch("/api/legal-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphs, useLlm }),
    });

    if (!response.ok) {
      // Niet-2xx status → degradeer stil naar lege lijst
      return [];
    }

    data = (await response.json()) as BackendResponse;
  } catch {
    // Netwerk- of JSON-parse-fout (backend niet bereikbaar, timeout, etc.)
    return [];
  }

  // De backend degradeert bij een upstream-fout naar { issues: [], error }. Log dat, zodat
  // een stille leegte herleidbaar is i.p.v. als "geen issues" gelezen te worden.
  if (data?.error) {
    console.warn("ClauseGuard AI-laag: backend meldde een upstream-fout:", data.error);
  }

  if (!Array.isArray(data?.issues)) return [];

  const issues: Issue[] = data.issues
    .filter((item) => {
      // Defensieve validatie: sla corrupte items over
      if (
        typeof item.paragraphIndex !== "number" ||
        typeof item.original !== "string" ||
        item.original.trim().length === 0 ||
        !LLM_CATEGORIES.includes(item.category as IssueCategory)
      ) {
        return false;
      }
      // Confidence-drempel: ontbrekende/onzin-confidence (NaN, >1) telt als zeker genoeg
      // (0.8 fallback, gelijk aan de server-default) zodat we geen geldige issues wegfilteren.
      const conf = clampConfidence(item.confidence) ?? 0.8;
      return conf >= CONFIDENCE_THRESHOLD;
    })
    .map((item, idx): Issue => {
      const category = item.category as IssueCategory;

      return {
        // Tijdelijk id — runChecks.ts overschrijft dit met een stabiele versie
        id: `llm-${item.paragraphIndex}-${idx}-${item.original.slice(0, 16)}`,
        category,
        severity: severityForCategory(category),
        original: item.original,
        // factual-vlaggen komen zonder suggestie (alleen markeren); lege string → undefined
        suggestion: item.suggestion || undefined,
        explanation: item.explanation,
        confidence: clampConfidence(item.confidence),
        paragraphIndex: item.paragraphIndex,
        // occurrence wordt door runChecks.ts herberekend over het hele document
        occurrence: 0,
        status: "pending",
        source: "llm",
      };
    });

  return issues;
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
