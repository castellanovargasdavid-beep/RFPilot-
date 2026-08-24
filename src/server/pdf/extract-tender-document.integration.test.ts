/**
 * Test de integración del pipeline de subida→extracción (Fase 2): ejecuta
 * el código real de extracción (pdfjs-dist) contra el pliego ficticio de
 * la Fase 7, sin mocks — es exactamente lo que corre el paso "extract-text"
 * del Inngest de extract-tender.ts sobre un archivo ya subido.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { extractTenderDocument } from "./index";

const MOCK_PDF_PATH = path.join(__dirname, "../../../prisma/fixtures/pliego-mantenimiento-informatico.pdf");

describe("extractTenderDocument (pliego real, texto nativo)", () => {
  it("extrae el texto completo del pliego de ejemplo sin recurrir a OCR", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractTenderDocument(buffer);

    expect(result.usedOcr).toBe(false);
    expect(result.extractionMethod).toBe("pdfjs-text");
    expect(result.pageCount).toBe(4);
    expect(result.text.length).toBeGreaterThan(1000);
  });

  it("conserva el contenido clave del pliego (cláusulas, importes, certificaciones)", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractTenderDocument(buffer);

    expect(result.text).toContain("ISO 9001");
    expect(result.text).toContain("480.000");
    expect(result.text).toContain("500.000");
    expect(result.text).toContain("Villaverde de la Sierra");
  });

  it("lanza un error controlado ante un buffer que no es un PDF válido", async () => {
    const invalidBuffer = Buffer.from("esto no es un PDF");
    await expect(extractTenderDocument(invalidBuffer)).rejects.toThrow(/PDF/i);
  });
});
