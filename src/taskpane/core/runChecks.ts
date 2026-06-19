// Orkestreert de volledige documentscan: leest paragrafen, draait de offline spellingcheck,
// berekent per-paragraaf occurrence-indices en assembleert het ScanResult.

import { readParagraphs } from "./wordDocument";
import { initSpellEngine, checkParagraphs } from "./spellEngine";
import { DocParagraph, Issue, LangMode, ScanResult } from "./types";

/**
 * Berekent en overschrijft het `occurrence`-veld op elk Issue.
 *
 * OCCURRENCE RULE: occurrence = de 0-based index van dit match onder alle matches van
 * dezelfde `original` string BINNEN DEZELFDE PARAGRAAF, in leesvolgorde (char-positie).
 * De resolver in trackChanges.ts zoekt paragraaf-gescoped (body.paragraphs[paragraphIndex]),
 * dus de teller moet ook per paragraaf lopen — niet document-breed. Zo blijft
 * (paragraphIndex + occurrence) een stabiele, eenduidige sleutel naar de juiste Range,
 * ook als hetzelfde woord in meerdere paragrafen voorkomt.
 */
function assignOccurrences(issues: Issue[], paragraphs: DocParagraph[]): Issue[] {
  if (issues.length === 0) return issues;

  const assignedCounters = new Map<string, number>();

  // Sorteer issues op (paragraphIndex ASC, dan positie in de paragraaftekst). De engine levert
  // ze al in leesvolgorde, maar we sorteren voor de zekerheid.
  const sorted = [...issues].sort((a, b) => {
    if (a.paragraphIndex !== b.paragraphIndex) return a.paragraphIndex - b.paragraphIndex;
    const paraText = paragraphs[a.paragraphIndex]?.text ?? "";
    const posA = paraText.indexOf(a.original);
    const posB = paraText.indexOf(b.original);
    return posA - posB;
  });

  for (const issue of sorted) {
    // Sleutel = paragraafindex + spatie + original; de spatie na de integer-index maakt elk
    // (paragraaf, original)-paar eenduidig (geen botsing tussen paragrafen).
    const key = `${issue.paragraphIndex} ${issue.original}`;
    const count = assignedCounters.get(key) ?? 0;
    issue.occurrence = count;
    assignedCounters.set(key, count + 1);
  }

  return issues;
}

/**
 * Kleine deterministische hash (djb2) — botsingsvrij genoeg om twee verschillende
 * `original`-strings die naar dezelfde genormaliseerde slug zouden vallen uit elkaar te houden.
 * Stabiel: dezelfde `original` geeft altijd dezelfde hash (belangrijk voor de carry-over van
 * reeds verwerkte issues over scans heen in useClauseGuard).
 */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Genereert een stabiele, unieke id voor een issue op basis van paragraphIndex, occurrence en
 * original (na occurrence-berekening). De hash-suffix voorkomt id-botsingen tussen twee
 * verschillende originals die na normalisatie/afkapping gelijk zouden zijn.
 */
function buildId(issue: Issue): string {
  const safeOriginal = issue.original.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  return `${issue.paragraphIndex}-${issue.occurrence}-${safeOriginal}-${hashString(issue.original)}`;
}

/**
 * Voert de volledige documentscan uit (volledig offline).
 * - Leest paragrafen
 * - Initialiseert de spellingengine (idempotent)
 * - Draait de offline spellcheck (nspell, NL+EN) in de gekozen taalstand
 * - Berekent per-paragraaf occurrence-indices
 * - Kent stabiele ids toe en zet status op "pending"
 * - Retourneert ScanResult met ISO-8601 scannedAt timestamp
 *
 * @param opts.mode - "auto" (per-paragraaf detectie, soepel) of "nl"/"en" (geforceerd, strikt).
 */
export async function runFullScan(opts: { mode: LangMode }): Promise<ScanResult> {
  const paragraphs = await readParagraphs();
  await initSpellEngine();

  const issues = assignOccurrences(checkParagraphs(paragraphs, opts.mode), paragraphs);

  for (const issue of issues) {
    issue.id = buildId(issue);
    issue.status = "pending";
  }

  return {
    issues,
    paragraphs,
    scannedAt: new Date().toISOString(),
  };
}
