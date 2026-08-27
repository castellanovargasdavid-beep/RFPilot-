/**
 * Test de integración de la indexación estructural (RAG anti-alucinación,
 * ver ARCHITECTURE.md): ejecuta extractStructuralDocument contra el pliego
 * ficticio real de la Fase 7, sin mocks, y comprueba que produce bloques
 * con página y bounding box coherentes — es la base sobre la que corre el
 * guardrail de verify-citation.ts.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { extractStructuralDocument } from "./structural-extract";
import { extractTenderDocument } from "./index";
import { verifyCitation } from "./verify-citation";

const MOCK_PDF_PATH = path.join(__dirname, "../../../prisma/fixtures/pliego-mantenimiento-informatico.pdf");

describe("extractStructuralDocument (pliego real)", () => {
  it("genera bloques con página y bounding box normalizado (0..1) para cada párrafo", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractStructuralDocument(buffer);

    expect(result.pageCount).toBe(4);
    expect(result.blocks.length).toBeGreaterThan(5);

    for (const block of result.blocks) {
      expect(block.pagina).toBeGreaterThanOrEqual(1);
      expect(block.pagina).toBeLessThanOrEqual(4);
      expect(block.bboxX).toBeGreaterThanOrEqual(0);
      expect(block.bboxX).toBeLessThanOrEqual(1);
      expect(block.bboxY).toBeGreaterThanOrEqual(0);
      expect(block.bboxY).toBeLessThanOrEqual(1);
      expect(block.bboxW).toBeGreaterThan(0);
      expect(block.bboxH).toBeGreaterThan(0);
    }
  });

  it("incluye marcadores [PÁGINA n] en el texto para que Claude pueda citar páginas con fundamento real", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractStructuralDocument(buffer);

    expect(result.pageMarkedText).toContain("[PÁGINA 1]");
    expect(result.pageMarkedText).toContain("[PÁGINA 4]");
  });

  it("una cita real del pliego (ISO 9001) se verifica correctamente contra sus propios bloques", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractStructuralDocument(buffer);

    const isoBlock = result.blocks.find((b) => b.text.includes("ISO 9001"));
    expect(isoBlock).toBeDefined();

    const verification = verifyCitation(isoBlock!.text, isoBlock!.pagina, result.blocks);
    expect(verification.verified).toBe(true);
  });

  it("una cita inventada NO se verifica contra los bloques reales del pliego (guardrail anti-alucinación)", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractStructuralDocument(buffer);

    const verification = verifyCitation(
      "se exige estar en posesión del certificado ISO 45001 de seguridad y salud laboral",
      1,
      result.blocks
    );
    expect(verification.verified).toBe(false);
  });

  it("extractTenderDocument expone los mismos bloques a través de structuralBlocks", async () => {
    const buffer = fs.readFileSync(MOCK_PDF_PATH);
    const result = await extractTenderDocument(buffer);

    expect(result.structuralBlocks.length).toBeGreaterThan(5);
  });
});
