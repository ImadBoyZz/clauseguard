// ClauseGuard — gedeelde datatypes (single source of truth).
// De add-in is volledig OFFLINE: de enige check is spellingcontrole via nspell (NL + EN).
// Alle modules produceren `Issue`-objecten volgens dit contract; de UI consumeert ze.
// Wijzig dit type met beleid: alles hangt eraan.

/** Taal van een fragment / van een geforceerde controle-stand. */
export type Lang = "nl" | "en";

/**
 * Door de gebruiker gekozen controle-stand (de taalkiezer in de Toolbar).
 * - "auto" → per-paragraaf taaldetectie; soepel: een woord is pas fout als GEEN van beide
 *            woordenboeken het kent (Engelse termen in een NL-doc blijven correct).
 * - "nl" / "en" → forceer die taal voor het hele document; STRIKT: alleen dat woordenboek
 *            telt, anderstalige woorden worden bewust als spelfout geflagd.
 */
export type LangMode = "auto" | "nl" | "en";

/** Levenscyclus van een suggestie in de task-pane. */
export type IssueStatus = "pending" | "accepted" | "rejected";

/**
 * Eén gedetecteerde spelfout in het document.
 * `paragraphIndex` + `occurrence` laten de track-changes-laag de exacte Word.Range
 * terugvinden via een paragraaf-gescopete search (zie core/trackChanges.ts).
 */
export interface Issue {
  /** Stabiele unieke id (zie buildId in runChecks.ts). */
  id: string;
  /** Het exact geflagde tekstfragment zoals het in het document staat. */
  original: string;
  /** Voorgestelde vervanging (nspell's beste gok). Afwezig als er geen suggestie is. */
  suggestion?: string;
  /** Uitleg in gewone taal: het "waarom" van de flag. */
  explanation: string;
  /** Taal waartegen dit fragment gecontroleerd is (bepaalt de NL/EN-chip in de UI). */
  language: Lang;
  /** Index van de paragraaf in het document (0-based). */
  paragraphIndex: number;
  /**
   * 0-based index van dit voorkomen van `original` BINNEN dezelfde paragraaf
   * (`paragraphIndex`), in leesvolgorde. Samen met `paragraphIndex` de sleutel voor de
   * paragraaf-gescopete range-resolutie in trackChanges.ts (niet document-breed).
   */
  occurrence: number;
  status: IssueStatus;
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
  scannedAt: string; // ISO timestamp, gezet door de caller
}

/**
 * Of een issue een toepasbare suggestie heeft (één bron van waarheid).
 * Een lege string telt NIET als suggestie — anders zou een issue als 'toegepast'
 * gemarkeerd worden zonder dat er iets in het document verandert.
 */
export function hasSuggestion(issue: Issue): boolean {
  return typeof issue.suggestion === "string" && issue.suggestion.length > 0;
}
