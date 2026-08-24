/**
 * Genera el PDF de ejemplo (pliego ficticio) usado como dato de demo —
 * ver prisma/fixtures/mock-tender-content.ts. Se ejecuta una vez y el PDF
 * resultante se commitea al repo; no hace falta volver a correrlo salvo
 * que cambie el contenido del fixture.
 *
 *   npx tsx scripts/generate-mock-tender-pdf.ts
 */
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

import { MOCK_TENDER_CONTENT, MOCK_TENDER_TITLE } from "../prisma/fixtures/mock-tender-content";

const OUTPUT_PATH = path.join(__dirname, "../prisma/fixtures/pliego-mantenimiento-informatico.pdf");

const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 60, right: 60 } });
const stream = fs.createWriteStream(OUTPUT_PATH);
doc.pipe(stream);

doc.info.Title = MOCK_TENDER_TITLE;

for (const block of MOCK_TENDER_CONTENT) {
  switch (block.type) {
    case "title":
      doc.font("Helvetica-Bold").fontSize(18).moveDown(0.5).text(block.text, { align: "left" });
      doc.moveDown(0.5);
      break;
    case "subtitle":
      doc.font("Helvetica-Bold").fontSize(14).text(block.text, { align: "left" });
      doc.moveDown(1);
      break;
    case "heading":
      doc.moveDown(1).font("Helvetica-Bold").fontSize(13).text(block.text);
      doc.moveDown(0.3);
      break;
    case "subheading":
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(11).text(block.text);
      doc.moveDown(0.2);
      break;
    case "paragraph":
      doc.font("Helvetica").fontSize(10.5).text(block.text, { align: "justify" });
      doc.moveDown(0.5);
      break;
    case "bullet":
      doc.font("Helvetica").fontSize(10.5).text(`•  ${block.text}`, { align: "justify", indent: 10 });
      doc.moveDown(0.3);
      break;
    case "pagebreak":
      doc.addPage();
      break;
  }
}

doc.end();

stream.on("finish", () => {
  console.log(`PDF generado: ${OUTPUT_PATH}`);
});
