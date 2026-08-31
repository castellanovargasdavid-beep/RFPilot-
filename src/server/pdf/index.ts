import { extractPdfText } from "./extract-text";
import { getPdfPageCount, MAX_OCR_PAGES, ocrSinglePageStructured } from "./ocr";
import { extractStructuralDocument, type StructuralBlock } from "./structural-extract";

export class PdfExtractionError extends Error {}

export interface TenderExtractionResult {
  text: string;
  pageCount: number;
  usedOcr: boolean;
  extractionMethod: "pdfjs-text" | "tesseract-ocr";
  warning?: string;
  /**
   * Bloques estructurales (página, cláusula, bounding box) para el
   * guardrail anti-alucinación y el visor split-screen — se generan tanto
   * de la capa de texto nativa (structural-extract.ts) como del OCR
   * (ocrSinglePageStructured en ocr.ts, a partir de los párrafos que
   * detecta Tesseract). Solo quedan vacíos si la indexación falla del
   * todo para ese documento.
   */
  structuralBlocks: StructuralBlock[];
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
    // Segunda pasada con pdfjs (barata, texto ya en memoria del sistema
    // operativo/caché) para obtener también los bloques estructurales con
    // bounding box — se mantiene como función separada de extractPdfText
    // para no acoplar el camino OCR (que no la necesita) a esta lógica.
    let structuralBlocks: StructuralBlock[] = [];
    let pageMarkedText = nativeResult.text;
    try {
      const structural = await extractStructuralDocument(buffer);
      structuralBlocks = structural.blocks;
      pageMarkedText = structural.pageMarkedText;
    } catch {
      // La indexación estructural es una mejora, no un requisito — si falla
      // (p.ej. un PDF con una capa de texto atípica), seguimos con el texto
      // plano ya extraído; el guardrail simplemente no podrá verificar citas.
    }

    return {
      text: pageMarkedText,
      pageCount: nativeResult.pageCount,
      usedOcr: false,
      extractionMethod: "pdfjs-text",
      structuralBlocks,
    };
  }

  try {
    const totalPages = await getPdfPageCount(buffer);
    const pagesToProcess = Math.min(totalPages, MAX_OCR_PAGES);
    const pageTexts: string[] = [];
    const structuralBlocks: StructuralBlock[] = [];
    let clause: string | null = null;
    let orderOffset = 0;

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await ocrSinglePageStructured(buffer, pageNum, clause, orderOffset);
      pageTexts.push(page.text);
      structuralBlocks.push(...page.blocks);
      clause = page.endClause;
      orderOffset += page.blocks.length;
    }

    return {
      text: pageTexts.join("\n\n"),
      pageCount: totalPages,
      usedOcr: true,
      extractionMethod: "tesseract-ocr",
      warning:
        totalPages > MAX_OCR_PAGES
          ? `El documento tiene ${totalPages} páginas escaneadas; por límite de procesamiento solo se analizaron por OCR las primeras ${pagesToProcess}.`
          : undefined,
      structuralBlocks,
    };
  } catch (ocrError) {
    if (nativeResult.text.length > 0) {
      return {
        text: nativeResult.text,
        pageCount: nativeResult.pageCount,
        usedOcr: false,
        extractionMethod: "pdfjs-text",
        warning: "El documento parece escaneado y el OCR falló; el texto extraído puede estar incompleto.",
        structuralBlocks: [],
      };
    }
    throw new PdfExtractionError(
      "El pliego parece un documento escaneado (sin texto extraíble) y el OCR también falló. Prueba a subir una versión con texto seleccionable.",
      { cause: ocrError }
    );
  }
}
