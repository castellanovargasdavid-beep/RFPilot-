import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Extracción de texto "nativo" del PDF (capa de texto ya presente en el
 * documento). No usamos pdf-parse: es un paquete sin mantenimiento desde
 * 2018 que falla con el xref de PDFs generados por herramientas modernas
 * (comprobado empíricamente). pdfjs-dist (Mozilla, activamente mantenido)
 * es además la misma librería que reutilizamos para renderizar páginas en
 * el fallback de OCR, así que es la única dependencia de PDF del proyecto.
 */
export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  charsPerPage: number;
  /** Heurística: por debajo de este umbral, el PDF probablemente es un escaneado sin capa de texto. */
  looksScanned: boolean;
}

const SCANNED_HEURISTIC_CHARS_PER_PAGE = 40;

export async function extractPdfText(buffer: Buffer): Promise<PdfTextExtractionResult> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pageTexts.push(pageText.trim());
    page.cleanup();
  }
  await pdf.destroy();

  const text = pageTexts.join("\n\n").trim();
  const pageCount = pdf.numPages || 1;
  const charsPerPage = text.length / pageCount;

  return {
    text,
    pageCount,
    charsPerPage,
    looksScanned: charsPerPage < SCANNED_HEURISTIC_CHARS_PER_PAGE,
  };
}
