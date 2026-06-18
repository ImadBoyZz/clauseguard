// Genereert demo-contract.docx uit de geverifieerde paragrafen in
// demo-contract.paragraphs.json. Elke JSON-paragraaf -> exact 1 Word-paragraaf,
// in dezelfde volgorde, zodat readParagraphs() identieke indices (0..14) ziet als
// de standalone-verificatie. GEEN extra/lege paragrafen of TOC (zou indices verschuiven).
//
// Run: node demo/build-demo.js

const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require("docx");

const here = __dirname;
const data = JSON.parse(
  fs.readFileSync(path.join(here, "demo-contract.paragraphs.json"), "utf8")
);
const paras = data.paragraphs; // [{index, text}]

// Welke paragraafindices zijn headings (blijven aparte body-paragrafen -> dankzij
// de per-paragraaf defined-term fix vervuilen ze de term-extractie niet meer).
const HEADINGS = new Set([2, 5, 9]);
// Definitie-paragrafen: lead-term vetgedrukt voor visuele duidelijkheid.
// (Bold is een aparte run; para.text blijft de volledige string -> check ongewijzigd.)
const DEFS = {
  3: "Dienstverlener",
  4: "Vertrouwelijke Informatie",
  10: "Confidential Information",
};

function bodyParagraph(text, boldLead) {
  if (boldLead && text.startsWith(boldLead)) {
    const rest = text.slice(boldLead.length); // begint met spatie
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 160, line: 276 },
      children: [
        new TextRun({ text: boldLead, bold: true }),
        new TextRun({ text: rest }),
      ],
    });
  }
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    children: [new TextRun({ text })],
  });
}

const children = paras.map((p) => {
  if (p.index === 0) {
    // Titel
    return new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: p.text })],
    });
  }
  if (HEADINGS.has(p.index)) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: p.text })],
    });
  }
  return bodyParagraph(p.text, DEFS[p.index]);
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } }, // 11pt
    paragraphStyles: [
      {
        id: "Title",
        name: "Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: "Calibri" },
        paragraph: { spacing: { after: 360 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Calibri", color: "1F3864" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4 (BE/EU)
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const out = path.join(here, "demo-contract.docx");
  fs.writeFileSync(out, buffer);
  console.log("WROTE:", out, "(" + buffer.length + " bytes, " + children.length + " paragrafen)");
});
