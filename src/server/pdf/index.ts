import { extractPdfText } from "./extract-text";
import { ocrPdfBuffer } from "./ocr";

export class PdfExtractionError extends Error {}

export interface TenderExtractionResult {
  text: string;
  pageCount: number;
  usedOcr: boolean;
  extractionMethod: "pdfjs-text" | "tesseract-ocr";
  warning?: string;
}

/**
 * Extrae el texto de un pliego: primero intenta la capa de texto nativa del
 * PDF; si el ratio de caracteres/página sugiere un escaneado, cae a OCR.
 * Nunca deja el pipeline a medias silenciosamente: si el OCR falla, se
 * queda con lo que pudo extraer nativamente (si hay algo) y adjunta un
 * aviso; solo lanza si no hay nada aprovechable.
 */
export async function extractTenderDocument(buffer: Buffer): Promise<TenderExtractionResult> {
  let nativeResult;
  try {
    nativeResult = await extractPdfText(buffer);
  } catch (error) {
    throw new PdfExtractionError("No se pudo leer el PDF: el archivo parece corrupto o no es un PDF válido.", {
      cause: error,
    });
  }

  if (!nativeResult.looksScanned) {
    return {
      text: nativeResult.text,
      pageCount: nativeResult.pageCount,
      usedOcr: false,
      extractionMethod: "pdfjs-text",
    };
  }

  try {
    const ocrResult = await ocrPdfBuffer(buffer);
    return {
      text: ocrResult.text,
      pageCount: ocrResult.totalPages,
      usedOcr: true,
      extractionMethod: "tesseract-ocr",
      warning: ocrResult.truncated
        ? `El documento tiene ${ocrResult.totalPages} páginas escaneadas; por límite de procesamiento solo se analizaron por OCR las primeras ${ocrResult.pagesProcessed}.`
        : undefined,
    };
  } catch (ocrError) {
    if (nativeResult.text.length > 0) {
      return {
        text: nativeResult.text,
        pageCount: nativeResult.pageCount,
        usedOcr: false,
        extractionMethod: "pdfjs-text",
        warning: "El documento parece escaneado y el OCR falló; el texto extraído puede estar incompleto.",
      };
    }
    throw new PdfExtractionError(
      "El pliego parece un documento escaneado (sin texto extraíble) y el OCR también falló. Prueba a subir una versión con texto seleccionable.",
      { cause: ocrError }
    );
  }
}
