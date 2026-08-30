import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import "./setup-worker";

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

export const SCANNED_HEURISTIC_CHARS_PER_PAGE = 40;

export interface PdfTextRangeResult {
  text: string;
  charCount: number;
  /** Nº total de páginas del documento (no solo del rango pedido). */
  pageCount: number;
}

/**
 * Extrae el texto nativo solo de un rango de páginas — existe para poder
 * trocear un pliego largo en varios steps de Inngest (igual que
 * ocrSinglePage trocea el OCR, ver src/server/pdf/ocr.ts): un PDF grande
 * puede tardar más de los 60s de una función serverless en plan Hobby de
 * Vercel incluso solo para leer su capa de texto nativa, antes de saber
 * siquiera si hace falta OCR — ver el orquestador en
 * src/inngest/functions/extract-tender.ts.
 */
export async function extractPdfTextRange(buffer: Buffer, startPage: number, endPage: number): Promise<PdfTextRangeResult> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const lastPage = Math.min(endPage, pdf.numPages);

  const pageTexts: string[] = [];
  for (let pageNum = startPage; pageNum <= lastPage; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pageTexts.push(pageText.trim());
    page.cleanup();
  }
  const pageCount = pdf.numPages || 1;
  await pdf.destroy();

  const text = pageTexts.join("\n\n").trim();
  return { text, charCount: text.length, pageCount };
}

export async function extractPdfText(buffer: Buffer): Promise<PdfTextExtractionResult> {
  const { text, charCount, pageCount } = await extractPdfTextRange(buffer, 1, Number.MAX_SAFE_INTEGER);
  const charsPerPage = charCount / pageCount;

  return {
    text,
    pageCount,
    charsPerPage,
    looksScanned: charsPerPage < SCANNED_HEURISTIC_CHARS_PER_PAGE,
  };
}
