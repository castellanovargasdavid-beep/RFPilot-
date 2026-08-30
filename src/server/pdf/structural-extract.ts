import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import "./setup-worker";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

/**
 * Indexación estructural del PDF: agrupa el texto de la capa nativa en
 * párrafos con página, cláusula vigente y bounding box normalizado (0..1,
 * origen arriba-izquierda) — la base del RAG de alta precisión (ver
 * ARCHITECTURE.md § RAG estructural). Solo funciona sobre la capa de texto
 * nativa; un pliego escaneado (OCR) no genera bloques — sus citas se
 * marcan "pendiente de revisión humana" en vez de intentar verificarlas
 * sin bounding boxes fiables (ver src/server/pdf/verify-citation.ts).
 */
export interface StructuralBlock {
  pagina: number;
  clausula: string | null;
  parrafo: number;
  text: string;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  order: number;
  /** true si el bloque tiene pinta de fila de tabla (varias celdas separadas por huecos horizontales grandes) — ver checkCitation() en analyze-tender.ts, nunca se confía ciegamente en una cita que caiga aquí. */
  esTabla: boolean;
}

export interface StructuralExtractionResult {
  /** Texto con marcadores de página ("[PÁGINA n]") — es lo que se manda a Claude, para que pueda citar páginas con fundamento real en vez de adivinar. */
  pageMarkedText: string;
  blocks: StructuralBlock[];
  pageCount: number;
  /**
   * Última cláusula vigente al terminar el rango procesado — solo relevante
   * cuando se llama por lotes de páginas (ver extractStructuralDocumentRange
   * más abajo); pásala como `initialClause` del siguiente lote para que una
   * cláusula que sigue vigente entre páginas no se "olvide" en el corte.
   */
  endClause: string | null;
}

interface PositionedLine {
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** true si esta línea parece una fila de tabla: varias "celdas" separadas por huecos horizontales mucho más anchos que un espacio de palabra normal. */
  looksLikeTableRow: boolean;
}

/** Un hueco horizontal mayor que esto (relativo a la altura de línea) se trata como separación de columnas, no como espacio entre palabras. */
const TABLE_GAP_FACTOR = 1.8;
/** Con al menos esta proporción de líneas "de tabla" en un párrafo, el bloque entero se marca esTabla. */
const TABLE_ROW_RATIO_THRESHOLD = 0.5;

const PARAGRAPH_GAP_FACTOR = 1.6;
const CLAUSE_PATTERN =
  /^(cl[aá]usula|art[ií]culo|anexo|apartado|punto)\s+([ivxlcdm]+|\d+(\.\d+)*)\b\.?|^\d+(\.\d+){1,4}\.?\s/i;

function extractClauseLabel(lineText: string): string | null {
  const match = lineText.match(CLAUSE_PATTERN);
  if (!match) return null;
  return match[0].replace(/\.?\s*$/, "").trim();
}

export interface StructuralExtractOptions {
  /** Primera página a procesar (1-indexed), inclusive. Por defecto, la 1. */
  startPage?: number;
  /** Última página a procesar, inclusive. Por defecto, la última del documento. */
  endPage?: number;
  /**
   * Cláusula vigente al empezar este lote (el `endClause` del lote
   * anterior) — sin esto, una cláusula abierta en la página 19 y que sigue
   * vigente en la 20 "se perdería" al cortar por lotes.
   */
  initialClause?: string | null;
  /** Desplaza `order` para que sea monótono creciente a través de lotes. */
  orderOffset?: number;
}

/**
 * Indexa el documento estructural completo, o solo un rango de páginas
 * (ver StructuralExtractOptions) — el rango existe para poder trocear un
 * pliego nativo largo en varios steps de Inngest, igual que ocrSinglePage
 * trocea el OCR (ver src/inngest/functions/extract-tender.ts): parsear
 * cientos de páginas de una vez puede superar los 60s de una función
 * serverless en plan Hobby de Vercel.
 */
export async function extractStructuralDocument(
  buffer: Buffer,
  options: StructuralExtractOptions = {}
): Promise<StructuralExtractionResult> {
  const { startPage = 1, initialClause = null, orderOffset = 0 } = options;
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const endPage = Math.min(options.endPage ?? pdf.numPages, pdf.numPages);

  const pageMarkedParts: string[] = [];
  const blocks: StructuralBlock[] = [];
  let globalOrder = orderOffset;
  let lastClause = initialClause;

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items = content.items.filter((item): item is TextItem => "str" in item && item.str.trim().length > 0);

    // Agrupa items en líneas por proximidad vertical (mismo "top" aprox.).
    const lines: PositionedLine[] = [];
    const sorted = [...items].sort((a, b) => {
      const topA = viewport.height - a.transform[5] - (a.height || 10);
      const topB = viewport.height - b.transform[5] - (b.height || 10);
      if (Math.abs(topA - topB) > 2) return topA - topB;
      return a.transform[4] - b.transform[4];
    });

    let currentLine: { items: TextItem[]; top: number; bottom: number } | null = null;
    for (const item of sorted) {
      const height = item.height || 10;
      const top = viewport.height - item.transform[5] - height;
      const bottom = viewport.height - item.transform[5];

      if (currentLine && Math.abs(top - currentLine.top) <= height * 0.6) {
        currentLine.items.push(item);
        currentLine.top = Math.min(currentLine.top, top);
        currentLine.bottom = Math.max(currentLine.bottom, bottom);
      } else {
        if (currentLine) lines.push(finalizeLine(currentLine, viewport.width));
        currentLine = { items: [item], top, bottom };
      }
    }
    if (currentLine) lines.push(finalizeLine(currentLine, viewport.width));

    // Agrupa líneas en párrafos: salto de cláusula o hueco vertical grande.
    const pageParagraphTexts: string[] = [];
    let currentClause: string | null = lastClause;
    let paragraph: PositionedLine[] = [];
    let paragraphIndex = 0;
    const avgLineHeight =
      lines.length > 0 ? lines.reduce((sum, l) => sum + (l.bottom - l.top), 0) / lines.length : 12;

    const flushParagraph = () => {
      if (paragraph.length === 0) return;
      const text = paragraph
        .map((l) => l.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) {
        paragraph = [];
        return;
      }
      const bboxLeft = Math.min(...paragraph.map((l) => l.left));
      const bboxTop = Math.min(...paragraph.map((l) => l.top));
      const bboxRight = Math.max(...paragraph.map((l) => l.right));
      const bboxBottom = Math.max(...paragraph.map((l) => l.bottom));
      const tableRowRatio = paragraph.filter((l) => l.looksLikeTableRow).length / paragraph.length;

      pageParagraphTexts.push(text);
      blocks.push({
        pagina: pageNum,
        clausula: currentClause,
        parrafo: paragraphIndex,
        text,
        bboxX: clamp01(bboxLeft / viewport.width),
        bboxY: clamp01(bboxTop / viewport.height),
        bboxW: clamp01((bboxRight - bboxLeft) / viewport.width),
        bboxH: clamp01((bboxBottom - bboxTop) / viewport.height),
        order: globalOrder++,
        esTabla: paragraph.length >= 2 && tableRowRatio >= TABLE_ROW_RATIO_THRESHOLD,
      });
      paragraphIndex++;
      paragraph = [];
    };

    for (const line of lines) {
      const clauseLabel = extractClauseLabel(line.text);
      const gap = paragraph.length > 0 ? line.top - paragraph[paragraph.length - 1].bottom : 0;
      const startsNewParagraph = paragraph.length === 0 || clauseLabel !== null || gap > avgLineHeight * PARAGRAPH_GAP_FACTOR;

      if (startsNewParagraph && paragraph.length > 0) {
        flushParagraph();
      }
      if (clauseLabel) currentClause = clauseLabel;
      paragraph.push(line);
    }
    flushParagraph();
    lastClause = currentClause;

    pageMarkedParts.push(`[PÁGINA ${pageNum}]\n${pageParagraphTexts.join("\n\n")}`);
    page.cleanup();
  }

  const pageCount = pdf.numPages || 1;
  await pdf.destroy();

  return {
    pageMarkedText: pageMarkedParts.join("\n\n").trim(),
    blocks,
    pageCount,
    endClause: lastClause,
  };
}

function finalizeLine(line: { items: TextItem[]; top: number; bottom: number }, pageWidth: number): PositionedLine {
  const sortedItems = [...line.items].sort((a, b) => a.transform[4] - b.transform[4]);
  const text = sortedItems.map((i) => i.str).join(" ");
  const left = Math.min(...sortedItems.map((i) => i.transform[4]));
  const right = Math.max(...sortedItems.map((i) => i.transform[4] + (i.width || 0)));
  const lineHeight = line.bottom - line.top || 10;

  let bigGaps = 0;
  for (let i = 1; i < sortedItems.length; i++) {
    const prevRight = sortedItems[i - 1].transform[4] + (sortedItems[i - 1].width || 0);
    const gap = sortedItems[i].transform[4] - prevRight;
    if (gap > lineHeight * TABLE_GAP_FACTOR) bigGaps++;
  }

  return {
    text,
    top: line.top,
    bottom: line.bottom,
    left,
    right: Math.min(right, pageWidth),
    looksLikeTableRow: bigGaps >= 2,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
