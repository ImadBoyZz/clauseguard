// Orkestreert de volledige documentscan: leest paragrafen, draait alle check-modules,
// berekent globale occurrence-indices en assembleert het ScanResult.

/* global console */

import { readParagraphs } from "./wordDocument";
import { initSpellEngine, checkParagraphs } from "./spellEngine";
import { findTermInconsistencies } from "./definedTerms";
import { checkLegalStyle, isLegalStyleConfigured } from "./legalStyle";
import { DocParagraph, Issue, ScanResult } from "./types";

/**
 * Berekent en overschrijft het `occurrence`-veld op elk Issue.
 *
 * OCCURRENCE RULE: occurrence = de 0-based index van dit match onder alle matches van
 * dezelfde `original` string BINNEN DEZELFDE PARAGRAAF, in leesvolgorde (char-positie).
 * De resolver in trackChanges.ts zoekt paragraaf-gescoped (body.paragraphs[paragraphIndex]),
 * dus de teller moet ook per paragraaf lopen — niet document-breed. Zo blijft
 * (paragraphIndex + occurrence) een stabiele, eenduidige sleutel naar de juiste Range,
 * ook als hetzelfde woord in meerdere paragrafen voorkomt.
 *
 * Aanpak: issues komen al in leesvolgorde uit de engines (paragraaf 0→n, in
 * token-/match-volgorde). We sorteren voor de zekerheid op (paragraphIndex, positie)
 * en kennen dan per (paragraaf, `original`) een oplopende teller toe.
 *
 * LET OP (bekende grens): occurrence is hier de N-de *gevonden issue* met deze
 * `original` in de paragraaf, niet per se de N-de *fysieke* match. Voor het gangbare geval
 * (één issue per fysiek voorkomen) komt dat overeen. Bij twee engines die exact hetzelfde
 * fragment flaggen kan dit afwijken — zie de occurrence-notitie in HANDOFF.md.
 */
function assignOccurrences(issues: Issue[], paragraphs: DocParagraph[]): Issue[] {
  if (issues.length === 0) return issues;

  // We tellen per (paragraphIndex, `original`) op in leesvolgorde. (Vroeger stond hier een
  // aparte positie-scan die nergens werd gebruikt, kwadratisch was op grote documenten én een
  // lookbehind-regex `(?<!…)` gebruikte die op de ES5/IE11-runtime een SyntaxError gooit.)
  const assignedCounters = new Map<string, number>();

  // Sorteer issues op (paragraphIndex ASC, dan positie in document)
  // We gaan ervan uit dat issues al in document-volgorde zijn (checkParagraphs loopt van 0→n)
  // maar we sorteren toch voor zekerheid.
  const sorted = [...issues].sort((a, b) => {
    if (a.paragraphIndex !== b.paragraphIndex) return a.paragraphIndex - b.paragraphIndex;
    // Binnen dezelfde paragraaf: sorteer op positie van de original in de tekst
    const paraText = paragraphs[a.paragraphIndex]?.text ?? "";
    const posA = paraText.indexOf(a.original);
    const posB = paraText.indexOf(b.original);
    return posA - posB;
  });

  for (const issue of sorted) {
    // Sleutel = paragraafindex + spatie + original; de spatie na de integer-index maakt elk (paragraaf, original)-paar eenduidig (geen botsing tussen paragrafen).
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
 * Genereert een stabiele, unieke id voor een issue op basis van source, paragraphIndex,
 * occurrence en original (na occurrence-berekening). De hash-suffix voorkomt id-botsingen
 * tussen twee verschillende originals die na normalisatie/afkapping gelijk zouden zijn.
 */
function buildId(issue: Issue): string {
  // Vervang speciale tekens in original om een leesbare id te maken
  const safeOriginal = issue.original.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  return `${issue.source}-${issue.paragraphIndex}-${issue.occurrence}-${safeOriginal}-${hashString(issue.original)}`;
}

/**
 * Voert de volledige documentscan uit.
 * - Leest paragrafen
 * - Initialiseert spellingengine
 * - Draait spellcheck + defined-terms check
 * - Optioneel: LLM legal-style check (alleen als useLlm=true én backend geconfigureerd)
 * - Berekent globale occurrence-indices
 * - Kent stabiele ids toe
 * - Zet status op "pending"
 * - Retourneert ScanResult met ISO-8601 scannedAt timestamp
 */
export async function runFullScan(opts: { useLlm: boolean }): Promise<ScanResult> {
  const { useLlm } = opts;

  // 1. Lees document
  const paragraphs = await readParagraphs();

  // 2. Init spellingengine (idempotent)
  await initSpellEngine();

  // 3. Verzamel issues van alle offline checks
  const spellIssues = checkParagraphs(paragraphs);
  const termIssues = findTermInconsistencies(paragraphs);

  let allIssues: Issue[] = [...spellIssues, ...termIssues];
  let usedLlm = false;

  // 4. LLM-check (optioneel)
  if (useLlm && isLegalStyleConfigured()) {
    try {
      const llmIssues = await checkLegalStyle(paragraphs, useLlm);
      // Dedup: laat een LLM-issue vallen als een offline engine (spelling/term) exact hetzelfde
      // fragment in dezelfde paragraaf al flagt. Anders krijg je bv. "Tegenwoordigh" twee keer
      // (nspell-spelling + LLM-grammar) en kunnen twee correcties om dezelfde Range vechten.
      const offlineKeys = new Set(allIssues.map((i) => `${i.paragraphIndex}\n${i.original}`));
      const freshLlm = llmIssues.filter(
        (i) => !offlineKeys.has(`${i.paragraphIndex}\n${i.original}`)
      );
      allIssues = [...allIssues, ...freshLlm];
      usedLlm = true;
    } catch (err) {
      console.warn("runFullScan: LLM legal-style check mislukt, wordt overgeslagen.", err);
    }
  }

  // 5. Bereken globale occurrence-indices (overschrijft de placeholder 0-waarden)
  allIssues = assignOccurrences(allIssues, paragraphs);

  // 6. Kent stabiele ids toe en zet status op "pending"
  for (const issue of allIssues) {
    issue.id = buildId(issue);
    issue.status = "pending";
  }

  return {
    issues: allIssues,
    paragraphs,
    usedLlm,
    scannedAt: new Date().toISOString(),
  };
}
