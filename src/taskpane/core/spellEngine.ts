// Offline spellingcheck via nspell + dictionary-nl + dictionary-en.
// De woordenboeken worden als raw strings ingeladen via webpack asset/source
// (zie webpack.config.js rule voor .aff/.dic), zodat we Node's fs-loader omzeilen.

import nspell from "nspell";

// dictionary-en v4 and dictionary-nl v2 restrict their package exports to index.js.
// We use webpack aliases (see webpack.config.js) that map these tokens to the
// absolute .aff/.dic file paths, bypassing the package exports field entirely.
// The asset/source rule in webpack then inlines the raw text as a string.
import enAff from "dict-en-aff";
import enDic from "dict-en-dic";
import nlAff from "dict-nl-aff";
import nlDic from "dict-nl-dic";

import { DocParagraph, Issue, IssueSource, Lang } from "./types";

// --- Module-scoped cache ---

/** nspell-instance per taal, gecached na eerste init. */
let spellNl: ReturnType<typeof nspell> | null = null;
let spellEn: ReturnType<typeof nspell> | null = null;
let initPromise: Promise<void> | null = null;
let ready = false;

// --- Tokenisatie helpers ---

/**
 * Tokeniseert een tekst op whitespace en leestekens.
 * Filtert lege strings, tokens korter dan 2 tekens, puur-digit/bevat-digit tokens
 * en ALL-CAPS tokens (waarschijnlijk afkortingen/gedefinieerde termen).
 */
function tokenize(text: string): string[] {
  // Splits op whitespace en veel voorkomende leestekens
  return text.split(/[\s.,;:!?()[\]{}"'""''«»\-–—/\\|@#$%^&*+=<>~`]+/).filter((token) => {
    if (!token) return false;
    if (token.length < 2) return false;
    // Puur digit of bevat een digit (getallen, datums, artikelnummers)
    if (/\d/.test(token)) return false;
    // ALL-CAPS: waarschijnlijk acroniem of gedefinieerde term — sla over
    if (token === token.toUpperCase() && /[A-Z]/.test(token)) return false;
    return true;
  });
}

// --- Publieke API ---

/**
 * Bouwt en cachet de nspell-instanties voor "nl" en "en".
 * Veilig om meerdere keren aan te roepen (guard op dubbele init).
 */
export async function initSpellEngine(): Promise<void> {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // nspell accepteert { aff: string, dic: string }
    spellNl = nspell({ aff: nlAff as string, dic: nlDic as string });
    spellEn = nspell({ aff: enAff as string, dic: enDic as string });
    ready = true;
  })();

  return initPromise;
}

/** Geeft true als de spellingengine gereed is voor gebruik. */
export function isSpellReady(): boolean {
  return ready;
}

/**
 * Detecteert de taal van een tekst door tokens te tellen die
 * door de NL- resp. EN-instantie als correct worden gemarkeerd.
 * Standaard "nl" bij gelijkstand.
 */
export function detectLanguage(text: string): Lang {
  if (!spellNl || !spellEn) return "nl";

  const tokens = tokenize(text);
  if (tokens.length === 0) return "nl";

  let nlScore = 0;
  let enScore = 0;

  for (const token of tokens) {
    if (spellNl.correct(token)) nlScore++;
    if (spellEn.correct(token)) enScore++;
  }

  return enScore > nlScore ? "en" : "nl";
}

/**
 * Controleert paragrafen op spelfouten en retourneert een Issue per fout token.
 * occurrence is 0 als placeholder — runChecks.ts overschrijft dit globaal.
 */
export function checkParagraphs(paragraphs: DocParagraph[]): Issue[] {
  if (!spellNl || !spellEn) return [];

  const issues: Issue[] = [];

  for (const para of paragraphs) {
    if (!para.text.trim()) continue;

    const lang = detectLanguage(para.text);
    const spell = lang === "nl" ? spellNl : spellEn;
    const tokens = tokenize(para.text);

    for (const token of tokens) {
      if (spell.correct(token)) continue;

      const suggestions = spell.suggest(token);
      const suggestion = suggestions[0];

      const explanation = suggestion
        ? `Mogelijke spelfout — bedoelde je "${suggestion}"?`
        : `Mogelijke spelfout (geen suggestie beschikbaar).`;

      // Tijdelijke id; wordt overschreven door runChecks.ts
      const tempId = `nspell-${para.index}-0-${token}`;

      issues.push({
        id: tempId,
        category: "spelling",
        severity: "spelling",
        original: token,
        suggestion,
        explanation,
        language: lang,
        paragraphIndex: para.index,
        occurrence: 0,
        status: "pending",
        source: "nspell" as IssueSource,
      });
    }
  }

  return issues;
}
