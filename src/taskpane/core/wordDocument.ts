/* global Word, console */

import { DocParagraph } from "./types";

/**
 * Verwijdert niet-printbare control-tekens uit de uitgelezen tekst.
 *
 * Word geeft in de tekst onzichtbare markeringen mee — met name het **comment-anker**
 * (U+0005) dat ontstaat bij `range.insertComment(...)`, en track-change-markers. Die plakken
 * aan een woord vast (bv. "agreement␅"), waardoor een reeds gecorrigeerd woord bij een
 * volgende scan ten onrechte als spelfout opduikt. We strippen het hele C0/C1-control-bereik,
 * maar behouden tab/newline/carriage-return.
 */
function sanitizeText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    // Strip C0/C1 control-tekens behalve tab (9), newline (10) en carriage return (13).
    if ((c <= 0x1f && c !== 9 && c !== 10 && c !== 13) || (c >= 0x7f && c <= 0x9f)) continue;
    out += text[i];
  }
  return out;
}

/**
 * Leest alle paragrafen uit het actieve Word-document.
 *
 * Gebruikt bij voorkeur de **reviewed** tekst (`Word.ChangeTrackingVersion = "Current"`):
 * dat is de tekst zoals die eruit ziet als alle tracked changes geaccepteerd zijn — dus
 * ZONDER de doorgehaalde (deleted) originelen.
 *
 * Waarom dit nodig is: in de Word JS API bevat `paragraph.text` / `range.text` óók de tekst
 * van tracked *deletions* (gedocumenteerde API-beperking, office-js #5874). Zonder deze fix
 * zou een reeds als tracked change toegepaste correctie bij een volgende scan opnieuw als
 * "fout" opduiken — want het oude, doorgehaalde woord staat technisch nog in `para.text`.
 *
 * `getReviewedText("Current")` is WordApi 1.4, maar is niet op elke Word-build betrouwbaar
 * geïmplementeerd (native vs online verschillen, office-js #5334). Daarom: bij élke fout val
 * we netjes terug op de ruwe `paragraph.text`.
 *
 * Lege paragrafen worden meegenomen maar niet gefilterd — de index moet 1-op-1 op de echte
 * paragraaf-indices in Word blijven liggen.
 */
export async function readParagraphs(): Promise<DocParagraph[]> {
  try {
    return await readParagraphsReviewed();
  } catch (err) {
    console.warn(
      "readParagraphs: getReviewedText niet beschikbaar of mislukt — val terug op paragraph.text.",
      err
    );
    return await readParagraphsPlain();
  }
}

/**
 * Leest de schone (changes-geaccepteerd) tekst per paragraaf via `getReviewedText("Current")`.
 * Eén sync laadt de paragraafcollectie, één sync resolveert alle reviewed-tekst-resultaten.
 */
async function readParagraphsReviewed(): Promise<DocParagraph[]> {
  return Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load("items");
    await context.sync();

    // getReviewedText geeft een ClientResult<string> terug; .value is pas na sync beschikbaar.
    const reviewed = paras.items.map((para) => para.getRange().getReviewedText("Current"));
    await context.sync();

    return reviewed.map((result, index) => ({ index, text: sanitizeText(result.value) }));
  });
}

/**
 * Fallback: ruwe paragraaftekst. Kan tracked deletions bevatten — alleen gebruikt als de
 * reviewed-leesweg op deze Word-build faalt (de hook-laag vangt reeds-verwerkte issues dan af).
 */
async function readParagraphsPlain(): Promise<DocParagraph[]> {
  return Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load("items/text");
    await context.sync();

    return paras.items.map((para, index) => ({ index, text: sanitizeText(para.text) }));
  });
}
