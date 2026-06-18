// Structurele analyse van gedefinieerde termen in juridische documenten.
// Geen AI — puur regex-heuristiek voor snelle, offline detectie.
//
// HEURISTIEK (conservative om false positives te beperken):
// 1. DEFINITIE-DETECTIE: zoek zinnen die een term expliciet definiëren via bekende patronen
//    in EN ("hereinafter", "means", quoted+capitalized in parentheses) en NL (hierna, betekent).
//    Alleen termen van ≥2 woorden OF met minimaal één hoofdletter worden opgenomen.
//    Korte, veelgebruikte woorden (< 4 tekens) worden genegeerd om ruis te vermijden.
// 2. VARIANTEN-DETECTIE: scan het hele document op near-variants die alleen in hoofdletter/klein
//    afwijken van de canonieke term. Een variant wordt alleen geflagd als:
//    - hij niet exact gelijk is aan de canonieke term (want dan is er geen probleem), EN
//    - hij verschilt enkel in casing (case-insensitive match maar niet case-sensitive match).
//    Gemeenschappelijke stopwoorden worden NIET als term herkend (te veel false positives).

import { DocParagraph, Issue } from "./types";

// Stopwoorden die NOOIT als gedefinieerde term herkend worden
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "to",
  "for",
  "with",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "must",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "de",
  "het",
  "een",
  "en",
  "of",
  "in",
  "op",
  "aan",
  "van",
  "voor",
  "met",
  "te",
  "dat",
  "die",
  "dit",
  "deze",
  "zijn",
  "is",
  "was",
  "worden",
  "wordt",
]);

/** Minimale lengte van een herkende gedefinieerde term (voorkomt ruis op korte woorden). */
const MIN_TERM_LENGTH = 4;

/**
 * Regex-patronen die een gedefinieerde term introduceren.
 * Capture group 1 = de canonieke term (inclusief aanhalingstekens die later worden gestript).
 *
 * Ondersteunde patronen:
 * - EN: ("Agreement"), (hereinafter "the Agreement"), "Agreement" means, Agreement means
 * - NL: ("de Overeenkomst"), hierna "de Overeenkomst" genoemd, "Overeenkomst" betekent
 */
const DEFINITION_PATTERNS: RegExp[] = [
  // ("Term") of (het "Term") — haakjes met aanhalingstekens, optioneel lidwoord
  /\(\s*(?:the|het|de|een|a|an)?\s*["“”]([A-Z][^"“”]+)["“”]\s*\)/g,

  // hereinafter ("Term") of hereinafter "Term"
  /hereinafter\s+(?:\([^)]*\)\s*)?["“”]([^"“”]+)["“”]/gi,

  // hierna "Term" genoemd
  /hierna\s+["“”]([^"“”]+)["“”]\s+genoemd/gi,

  // "Term" means / "Term" betekent
  /["“”]([A-Z][^"“”]+)["“”]\s+(?:means|betekent|shall mean|wordt gedefinieerd als)/g,

  // Term means (zonder aanhalingstekens, alleen gecapitaliseerd woord of meerdere woorden)
  /\b([A-Z][a-zA-Z]{3,}(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:means|betekent|shall mean)\b/g,
];

/**
 * Extraheert de canonieke set van gedefinieerde termen uit de paragrafen.
 * Retourneert een Map: lowercase(term) -> canonieke term (exact zoals gedefinieerd).
 */
function extractDefinedTerms(paragraphs: DocParagraph[]): Map<string, string> {
  const canonical = new Map<string, string>();

  // Per paragraaf scannen — definitiepatronen mogen NIET over paragraafgrenzen heen
  // matchen. Bij een join("\n") absorbeert de \s in de patronen de heading op de vorige
  // regel in de term (bv. "Definities\nDienstverlener" i.p.v. "Dienstverlener"), waardoor
  // de variant-detectie de term daarna nooit terugvindt.
  for (const para of paragraphs) {
    for (const pattern of DEFINITION_PATTERNS) {
      // Reset lastIndex voor globale regexen
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(para.text)) !== null) {
        // Strip aanhalingstekens en witruimte van de gevangen term
        const raw = match[1].replace(/["“”]/g, "").trim();

        if (raw.length < MIN_TERM_LENGTH) continue;
        if (STOPWORDS.has(raw.toLowerCase())) continue;

        // Sla op onder lowercase sleutel → canonieke waarde
        const key = raw.toLowerCase();
        if (!canonical.has(key)) {
          canonical.set(key, raw);
        }
      }
    }
  }

  return canonical;
}

/**
 * Zoekt in een tekst naar alle gehele-woord-overeenkomsten van een term (case-insensitive).
 * Retourneert de gevonden tekstfragmenten (exact zoals ze in de tekst staan).
 */
function findVariants(text: string, lowerTerm: string, canonicalTerm: string): string[] {
  const variants: string[] = [];
  // Escape speciale regex-tekens in de term
  const escaped = lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "gi");

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const found = m[0];
    // Alleen flaggen als het NIET identiek is aan de canonieke term (case-sensitive)
    if (found !== canonicalTerm) {
      variants.push(found);
    }
  }

  return variants;
}

/**
 * Detecteert inconsistent gebruik van gedefinieerde termen.
 * occurrence is 0 als placeholder — runChecks.ts overschrijft dit globaal.
 */
export function findTermInconsistencies(paragraphs: DocParagraph[]): Issue[] {
  const canonical = extractDefinedTerms(paragraphs);
  if (canonical.size === 0) return [];

  const issues: Issue[] = [];

  for (const para of paragraphs) {
    if (!para.text.trim()) continue;

    for (const [lowerTerm, canonicalTerm] of canonical.entries()) {
      const variants = findVariants(para.text, lowerTerm, canonicalTerm);

      for (const variant of variants) {
        const tempId = `definedTerms-${para.index}-0-${variant}`;

        issues.push({
          id: tempId,
          category: "term",
          severity: "critical",
          original: variant,
          suggestion: canonicalTerm,
          explanation: `Inconsistent gebruik van gedefinieerde term — gebruik "${canonicalTerm}" (consistentie van gedefinieerde begrippen).`,
          paragraphIndex: para.index,
          occurrence: 0,
          status: "pending",
          source: "definedTerms",
        });
      }
    }
  }

  return issues;
}
