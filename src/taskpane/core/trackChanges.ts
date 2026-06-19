/* global Word, Office, console */

import { Issue, hasSuggestion } from "./types";
import { cg } from "../theme";

// --- Runtime capability gates ---

/**
 * Controleert of track-changes (WordApi 1.4) ondersteund wordt.
 */
export function isTrackChangesSupported(): boolean {
  return Office.context.requirements.isSetSupported("WordApi", "1.4");
}

/**
 * Controleert of accepteren/afwijzen van wijzigingen (WordApi 1.6) ondersteund wordt.
 */
export function isReviewSupported(): boolean {
  return Office.context.requirements.isSetSupported("WordApi", "1.6");
}

// --- Core bewerkingen ---

/**
 * Bouwt de tekst van de Word-opmerking die bij een correctie hoort.
 * Bewust kort: enkel het "waarom" (LegalFly's #1 waarde). De wijziging zelf
 * (origineel → suggestie) is al zichtbaar als de tracked change, dus die herhalen
 * we niet in de opmerking.
 */
function buildCommentText(issue: Issue): string {
  return issue.explanation;
}

/**
 * Zoekt het fragment van een issue op, GESCOPED op zijn paragraaf via paragraphIndex.
 * Dit is bewust paragraaf-gescoped i.p.v. document-breed: occurrence wordt per paragraaf
 * geteld (zie runChecks.ts), en een document-brede `body.search` geeft bij meerwoord-
 * fragmenten en slimme aanhalingstekens stille missers / verkeerde occurrence.
 *
 * `matchWholeWord` alleen voor enkelvoudige tokens (geen spaties): bij een meerwoord-
 * fragment zou whole-word de match juist breken. De caller laadt `.items` en sync't zelf.
 * Geeft null als de paragraaf niet bestaat (issue wordt dan stil overgeslagen).
 */
function searchForIssue(
  paragraphs: Word.ParagraphCollection,
  issue: Issue
): Word.RangeCollection | null {
  const para = paragraphs.items[issue.paragraphIndex];
  if (!para) return null;
  // matchWholeWord alleen voor "schone" enkelvoudige tokens. Bij spaties (meerwoord) of
  // rand-leestekens (koppelteken/apostrof) wijkt Word's whole-word-grens af van de
  // detectie-grens → dan whole-word uit, anders valt de match stil weg.
  const matchWholeWord = !/[\s'’\-–—]/.test(issue.original);
  return para.getRange().search(issue.original, { matchCase: true, matchWholeWord });
}

/**
 * Past de voorgestelde correcties toe als bijgehouden wijzigingen (track changes) én
 * plaatst bij elke correctie een Word-opmerking met de uitleg ("waarom aangepast").
 * - Zet TrackAll aan vóór de eerste insertText-aanroep.
 * - Vervangingen gaan in één batch (kritieke stap); opmerkingen zijn best-effort en
 *   mogen de toegepaste correcties nooit breken (aparte sync in try/catch).
 * - Slaat issues zonder suggestion of met een niet-oplosbaar bereik stilletjes over.
 */
export async function applyCorrections(issues: Issue[]): Promise<void> {
  const toApply = issues.filter((issue) => hasSuggestion(issue) && issue.status === "pending");
  if (toApply.length === 0) return;

  // insertComment is WordApi 1.4 — zelfde gate als track changes.
  const commentsOk = isTrackChangesSupported();

  await Word.run(async (context) => {
    const doc = context.document;
    const body = doc.body;

    // Onthoud de huidige bijhoud-modus zodat we die na afloop kunnen herstellen — anders
    // blijft Track Changes globaal aan voor de rest van de bewerksessie van de gebruiker
    // (een ongevraagde neveneffect op hun document). Lezen is best-effort: lukt het niet,
    // dan herstellen we niet, maar de correcties gaan altijd door.
    let originalMode: Word.ChangeTrackingMode | null = null;
    try {
      doc.load("changeTrackingMode");
      await context.sync();
      originalMode = doc.changeTrackingMode as Word.ChangeTrackingMode;
    } catch {
      originalMode = null;
    }

    // Zet bijhouden aan — TrackAll werkt betrouwbaarder dan TrackMineOnly op Windows
    doc.changeTrackingMode = Word.ChangeTrackingMode.trackAll;

    // Laad de paragrafen één keer: range-resolutie is paragraaf-gescoped (zie searchForIssue),
    // want occurrence wordt per paragraaf geteld (runChecks.ts). Een document-brede search zou
    // bij meerwoord-fragmenten + slimme aanhalingstekens stille missers / verkeerde occurrence geven.
    const paragraphs = body.paragraphs;
    paragraphs.load("items");
    await context.sync();

    // Fase 1: paragraaf-gescopete exacte search per issue (collecties laden vóór sync)
    const phase1 = toApply.map((issue) => {
      const search = searchForIssue(paragraphs, issue);
      if (search) search.load("items");
      return { issue, search };
    });

    await context.sync();

    // Resolveer fase 1; verzamel wat nog niet exact gevonden is voor de fallback.
    const resolved: Array<{ issue: Issue; range: Word.Range }> = [];
    const unresolved: Issue[] = [];
    for (const { issue, search } of phase1) {
      const range = search ? search.items[issue.occurrence] : undefined;
      if (range) resolved.push({ issue, range });
      else unresolved.push(issue);
    }

    // Fase 1b (alleen indien nodig): robuustere fallback voor niet-exact gevonden fragmenten.
    // (a) paragraaf-gescoped met ignorePunct/ignoreSpace → vangt smart/straight-quote- en
    //     spatie-verschillen (bv. citaten). (b) document-breed exact → vangt een verkeerd
    //     ingeschatte paragraphIndex. Beide alleen bij een ÉÉNDUIDIGE match, zodat we nooit
    //     de verkeerde plek vervangen.
    if (unresolved.length > 0) {
      const fb = unresolved.map((issue) => {
        const para = paragraphs.items[issue.paragraphIndex];
        const punct = para
          ? para.getRange().search(issue.original, {
              matchCase: true,
              matchWholeWord: false,
              ignorePunct: true,
              ignoreSpace: true,
            })
          : null;
        const wide = body.search(issue.original, { matchCase: true, matchWholeWord: false });
        if (punct) punct.load("items");
        wide.load("items");
        return { issue, punct, wide };
      });

      await context.sync();

      for (const { issue, punct, wide } of fb) {
        let range: Word.Range | undefined;
        if (punct && punct.items.length > 0) {
          range =
            punct.items[issue.occurrence] ??
            (punct.items.length === 1 ? punct.items[0] : undefined);
        }
        if (!range && wide.items.length === 1) {
          range = wide.items[0];
        }
        if (range) resolved.push({ issue, range });
      }
    }

    if (resolved.length < toApply.length) {
      console.warn(
        `applyCorrections: ${toApply.length - resolved.length} correctie(s) niet vindbaar in het document — overgeslagen.`
      );
    }

    // Fase 2: vervang de tekst als tracked change; onthoud het nieuwe bereik + comment-tekst
    const commentTargets: Array<{ range: Word.Range; text: string }> = [];
    for (const { issue, range } of resolved) {
      // insertText("Replace") retourneert het bereik van de ingevoegde tekst —
      // daar hangen we straks de opmerking aan.
      const newRange = range.insertText(issue.suggestion!, Word.InsertLocation.replace);
      // Markeer het verbeterde woord rood in het document. Bovenop de tracked change, zodat
      // de correctie altijd opvalt — ook in 'Eenvoudige markeringen' en na accepteren. De
      // kleurwijziging valt binnen dezelfde kritieke sync hieronder (geen extra round-trip).
      newRange.font.color = cg.docRedline;
      if (commentsOk) {
        commentTargets.push({ range: newRange, text: buildCommentText(issue) });
      }
    }

    await context.sync(); // correcties toepassen (kritieke stap)

    // Herstel de oorspronkelijke bijhoud-modus (best-effort). De zojuist gemaakte tracked
    // changes blijven bestaan; alleen TOEKOMSTIGE bewerkingen van de gebruiker worden weer
    // volgens hun eigen instelling behandeld.
    if (originalMode !== null && originalMode !== Word.ChangeTrackingMode.trackAll) {
      try {
        doc.changeTrackingMode = originalMode;
        await context.sync();
      } catch (err) {
        console.warn("applyCorrections: bijhoud-modus herstellen mislukt.", err);
      }
    }

    // Fase 3: opmerkingen als best-effort — falen mag de correcties niet ongedaan maken
    if (commentTargets.length > 0) {
      try {
        for (const target of commentTargets) {
          target.range.insertComment(target.text);
        }
        await context.sync();
      } catch (err) {
        console.warn(
          "applyCorrections: opmerkingen invoegen mislukt (de correcties zijn wel toegepast).",
          err
        );
      }
    }
  });
}

/**
 * Selecteert het tekstbereik van een issue in het document.
 * Retourneert true als het bereik gevonden en geselecteerd is, anders false.
 */
export async function selectIssueRange(issue: Issue): Promise<boolean> {
  try {
    return await Word.run(async (context) => {
      const body = context.document.body;
      const paragraphs = body.paragraphs;
      paragraphs.load("items");
      await context.sync();

      const para = paragraphs.items[issue.paragraphIndex];
      if (!para) return false;

      // Zelfde strategie als applyCorrections: exact, dan een quote/spatie-tolerante fallback.
      const exact = searchForIssue(paragraphs, issue);
      const punct = para.getRange().search(issue.original, {
        matchCase: true,
        matchWholeWord: false,
        ignorePunct: true,
        ignoreSpace: true,
      });
      if (exact) exact.load("items");
      punct.load("items");
      await context.sync();

      let range: Word.Range | undefined;
      if (exact && exact.items.length > 0) range = exact.items[issue.occurrence];
      if (!range && punct.items.length > 0) {
        range =
          punct.items[issue.occurrence] ?? (punct.items.length === 1 ? punct.items[0] : undefined);
      }
      if (!range) return false;

      range.select();
      await context.sync();
      return true;
    });
  } catch {
    return false;
  }
}

/**
 * Accepteert alle bijgehouden wijzigingen in de documentbody (WordApi 1.6).
 * Omhult in try/catch want een "verplaatste" tracked change kan sync() laten gooien (issue #5535).
 */
export async function acceptAllTrackedChanges(): Promise<void> {
  await Word.run(async (context) => {
    try {
      const body = context.document.body;
      body.getTrackedChanges().acceptAll();
      await context.sync();
    } catch (err) {
      console.warn("acceptAllTrackedChanges: sync fout (mogelijk verplaatste wijziging).", err);
    }
  });
}

/**
 * Verwerpt alle bijgehouden wijzigingen in de documentbody (WordApi 1.6).
 * Omhult in try/catch voor hetzelfde geval als bij acceptAllTrackedChanges.
 */
export async function rejectAllTrackedChanges(): Promise<void> {
  await Word.run(async (context) => {
    try {
      const body = context.document.body;
      body.getTrackedChanges().rejectAll();
      await context.sync();
    } catch (err) {
      console.warn("rejectAllTrackedChanges: sync fout (mogelijk verplaatste wijziging).", err);
    }
  });
}
