// Genereert demo-essay.docx uit de paragrafen in demo-essay.paragraphs.json.
// Een Nederlands schoolopstel vol opzettelijke fouten — regressietest voor de
// uitgebreide AI-proeflezer (spelling/grammar/style/consistency/factual).
//
// Elke JSON-paragraaf -> exact 1 Word-paragraaf, in dezelfde volgorde, zodat
// readParagraphs() identieke indices (0..3) ziet als de antwoordsleutel.
// GEEN headings, GEEN titel, GEEN lege paragrafen (zou indices verschuiven).
//
// Run: node demo/build-demo-essay.js

const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require("docx");

const here = __dirname;
const data = JSON.parse(
  fs.readFileSync(path.join(here, "demo-essay.paragraphs.json"), "utf8")
);
const paras = data.paragraphs; // [{index, text}]

// Vier justified body-paragrafen, zelfde opzet als demo-contract (Calibri 11pt,
// spacing). Geen bold leads, geen headings — puur lopende tekst.
const children = paras.map(
  (p) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 160, line: 276 },
      children: [new TextRun({ text: p.text })],
    })
);

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } }, // 11pt
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
  const out = path.join(here, "demo-essay.docx");
  fs.writeFileSync(out, buffer);
  console.log(
    "WROTE:",
    out,
    "(" + buffer.length + " bytes, " + children.length + " paragrafen)"
  );
});
