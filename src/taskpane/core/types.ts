// ClauseGuard — gedeelde datatypes (single source of truth).
// Alle modules (spelling, defined-terms, LLM legal-style) produceren `Issue`-objecten
// volgens dit contract; de UI consumeert ze. Wijzig dit type met beleid: alles hangt eraan.

/** Welke check de issue vond. */
export type IssueCategory =
  | "spelling" // nspell (offline woordenboek): niet-bestaande woorden
  | "term" // defined-term consistency (structureel): inconsistent gebruikte contractdefinitie
  | "grammar" // LLM: congruentie (onderwerp-werkwoord), d/t-fouten, woordvolgorde, verbuiging
  | "style" // LLM: vaag/omslachtig/onhelder taalgebruik, juridisch onzekere termen
  | "consistency" // LLM: interne tegenstrijdigheid/onlogica, afleidbaar uit de tekst zelf
  | "factual"; // LLM zachte vlag: mogelijke feitfout die externe wereldkennis vereist (geen autocorrectie)

/**
 * Severity-tier zoals getoond in de UI (LegalFly-stijl: gegroepeerd op ernst).
 * - "spelling"  → blauw/laag: spelfout
 * - "advisory"  → geel/midden: stijl/grammatica-advies
 * - "critical"  → rood/hoog: juridisch risico (bv. inconsistente gedefinieerde term)
 */
export type Severity = "spelling" | "advisory" | "critical";

/** Levenscyclus van een suggestie in de task-pane. */
export type IssueStatus = "pending" | "accepted" | "rejected";

/** Taal van het fragment. */
export type Lang = "nl" | "en";

/** Welke engine de issue genereerde (voor debugging/telemetrie/audit-trail). */
export type IssueSource = "nspell" | "definedTerms" | "llm";

/**
 * Status van de AI-backend voor de UI-indicator.
 * - "ok"      → backend bereikbaar én een API-key aanwezig (AI-laag werkt echt).
 * - "nokey"   → backend draait, maar geen OPENROUTER_API_KEY → elke AI-scan blijft leeg.
 * - "offline" → backend niet bereikbaar (niet gestart).
 */
export type AiStatus = "ok" | "nokey" | "offline";

/**
 * Eén gedetecteerd probleem in het document.
 * `paragraphIndex` + `occurrence` laten de track-changes-laag de exacte Word.Range
 * terugvinden via body.search() (zie core/trackChanges.ts).
 */
export interface Issue {
  /** Stabiele unieke id (bv. `${source}-${paragraphIndex}-${occurrence}-${original}`). */
  id: string;
  category: IssueCategory;
  severity: Severity;
  /** Het exact geflagde tekstfragment zoals het in het document staat. */
  original: string;
  /** Voorgestelde vervanging. Afwezig voor louter informatieve adviezen. */
  suggestion?: string;
  /** Uitleg in gewone taal: het "waarom" (LegalFly's #1 productwaarde). */
  explanation: string;
  /** Vertrouwen 0..1 (vooral relevant voor LLM-suggesties). */
  confidence?: number;
  language?: Lang;
  /** Index van de paragraaf in het document (0-based). */
  paragraphIndex: number;
  /**
   * 0-based index van dit voorkomen van `original` BINNEN dezelfde paragraaf
   * (`paragraphIndex`), in leesvolgorde. Samen met `paragraphIndex` de sleutel voor de
   * paragraaf-gescopete range-resolutie in trackChanges.ts (niet document-breed).
   */
  occurrence: number;
  status: IssueStatus;
  source: IssueSource;
}

/** Eén paragraaf zoals uitgelezen uit het document. */
export interface DocParagraph {
  index: number;
  text: string;
}

/** Resultaat van een volledige documentscan. */
export interface ScanResult {
  issues: Issue[];
  paragraphs: DocParagraph[];
  /** Of de LLM-laag is meegedraaid (false = offline-only run). */
  usedLlm: boolean;
  scannedAt: string; // ISO timestamp, gezet door de caller (Date is niet beschikbaar in sommige contexten)
}

/**
 * Of een issue een toepasbare suggestie heeft (één bron van waarheid).
 * Een lege string telt NIET als suggestie — anders zou een issue als 'toegepast'
 * gemarkeerd worden zonder dat er iets in het document verandert.
 */
export function hasSuggestion(issue: Issue): boolean {
  return typeof issue.suggestion === "string" && issue.suggestion.length > 0;
}

/** Mapt een IssueCategory naar de UI-severity-tier. */
export function severityForCategory(category: IssueCategory): Severity {
  switch (category) {
    case "spelling":
      return "spelling";
    case "term":
      return "critical";
    case "grammar":
    case "style":
    case "consistency":
    case "factual":
    default:
      return "advisory";
  }
}

/** Nederlandse labels voor de severity-badges in de UI. */
export const SEVERITY_LABEL: Record<Severity, string> = {
  spelling: "Spelling",
  advisory: "Stijl",
  critical: "Kritiek",
};
