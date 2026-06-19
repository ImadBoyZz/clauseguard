// Genereert demo-showcase.docx uit demo-showcase.paragraphs.json.
// Showcase-document dat ELKE ClauseGuard-engine raakt (spelling, gedefinieerde termen,
// ongedefinieerde term, dode definitie, gebroken kruisverwijzing + AI-laag-stof).
// Elke JSON-paragraaf -> exact 1 Word-paragraaf, zelfde volgorde, zodat readParagraphs()
// identieke indices (0..17) ziet als de standalone-verificatie.
//
// Run: node demo/build-demo-showcase.js

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
  fs.readFileSync(path.join(here, "demo-showcase.paragraphs.json"), "utf8")
);
const paras = data.paragraphs; // [{index, text}]

// Kop-paragrafen (blijven aparte body-paragrafen).
const HEADINGS = new Set([2, 6, 9, 12]);
// Definitie-paragrafen: lead-term vet voor visuele duidelijkheid (bold is een aparte run;
// para.text blijft de volledige string -> check ongewijzigd).
const DEFS = {
  3: "Leverancier",
  4: "Vertrouwelijke Gegevens",
  5: "Overmacht",
  13: "Confidential Data",
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
  const out = path.join(here, "demo-showcase.docx");
  fs.writeFileSync(out, buffer);
  console.log("WROTE:", out, "(" + buffer.length + " bytes, " + children.length + " paragrafen)");
});
