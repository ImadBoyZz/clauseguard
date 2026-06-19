// Orkestreert de volledige documentscan: leest paragrafen, draait alle check-modules,
// berekent globale occurrence-indices en assembleert het ScanResult.

/* global console */

import { readParagraphs } from "./wordDocument";
import { initSpellEngine, checkParagraphs } from "./spellEngine";
import { checkLegalStyle, isLegalStyleConfigured } from "./legalStyle";
import { rerankSpellSuggestions } from "./spellRerank";
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
/**
 * Normaliseert een fragment voor een tolerante "staat dit (nog) letterlijk in de paragraaf?"-check:
 * alle witruimte, leestekens en aanhalingstekens (recht én slim) eruit, lowercase. Dit spiegelt
 * grofweg de ignorePunct/ignoreSpace-tolerantie van de range-resolver in trackChanges.ts, zodat de
 * backstop hieronder alléén écht onvindbare fragmenten wegfiltert en geen valse drops doet op louter
 * quote- of spatieverschillen. Een verschil in de letters zélf (bv. "betaling" vs "betalign") blijft
 * wél een mismatch — precies wat we willen vangen.
 */
function normalizeForLocate(s: string): string {
  return s.replace(/[\s.,;:!?()[\]{}"'’‘“”„«»\-–—/\\]/g, "").toLowerCase();
}

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
 * - Draait offline spellcheck (nspell)
 * - Optioneel: LLM grammatica/stijl check (alleen als useLlm=true én backend geconfigureerd)
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

  // 3. Offline spellingcheck (nspell, NL+EN)
  const spellIssues = checkParagraphs(paragraphs);

  // 3b. Context-rerank van de spelsuggesties (best-effort, backend-afhankelijk). Kiest per spelfout
  //     de zin-passende kandidaat (bv. "parties" i.p.v. "partied"). Verandert NOOIT het aantal fouten,
  //     alleen de voorgestelde correctie. Staat LOS van useLlm: ook met de AI-adviezen uit blijven de
  //     spelsuggesties slim. Faalt graceful → offline #1-gok blijft staan.
  try {
    await rerankSpellSuggestions(spellIssues, paragraphs);
  } catch (err) {
    console.warn("runFullScan: spell-rerank overgeslagen.", err);
  }

  let allIssues: Issue[] = [...spellIssues];
  let usedLlm = false;

  // 4. LLM-check (optioneel)
  if (useLlm && isLegalStyleConfigured()) {
    try {
      const llmIssues = await checkLegalStyle(paragraphs, useLlm);
      // Dedup: laat een LLM-issue vallen als de offline spellingcheck exact hetzelfde fragment
      // in dezelfde paragraaf al flagt. Anders krijg je bv. "Tegenwoordigh" twee keer
      // (nspell-spelling + LLM-grammar) en kunnen twee correcties om dezelfde Range vechten.
      const offlineKeys = new Set(allIssues.map((i) => `${i.paragraphIndex}\n${i.original}`));
      const freshLlm = llmIssues.filter(
        (i) => !offlineKeys.has(`${i.paragraphIndex}\n${i.original}`)
      );
      // Backstop: gooi elk LLM-issue weg waarvan de `original` niet (tolerant) letterlijk in zijn
      // paragraaf staat. Het model "verbetert" soms stilletjes een spelfout uit de brontekst (bv.
      // doc "betalign" → original "betaling"), waardoor de range-resolver in trackChanges.ts het
      // fragment nooit vindt: Vind selecteert niets en Accepteer past niets toe — een dode kaart.
      // Liever geen kaart dan een kapotte. nspell-issues komen altijd uit de paragraaftekst zelf en
      // passeren dus altijd; dit raakt alleen losgeslagen LLM-fragmenten.
      const locatableLlm = freshLlm.filter((issue) => {
        const paraText = paragraphs[issue.paragraphIndex]?.text ?? "";
        const found =
          normalizeForLocate(paraText).indexOf(normalizeForLocate(issue.original)) !== -1;
        if (!found) {
          console.warn(
            `runFullScan: LLM-issue overgeslagen — "${issue.original}" staat niet letterlijk in paragraaf ${issue.paragraphIndex} (model normaliseerde de brontekst); zonder match zouden Vind/Accepteer niets doen.`
          );
        }
        return found;
      });
      allIssues = [...allIssues, ...locatableLlm];
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
