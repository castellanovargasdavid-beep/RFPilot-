import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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
}

export interface StructuralExtractionResult {
  /** Texto con marcadores de página ("[PÁGINA n]") — es lo que se manda a Claude, para que pueda citar páginas con fundamento real en vez de adivinar. */
  pageMarkedText: string;
  blocks: StructuralBlock[];
  pageCount: number;
}

interface PositionedLine {
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const PARAGRAPH_GAP_FACTOR = 1.6;
const CLAUSE_PATTERN =
  /^(cl[aá]usula|art[ií]culo|anexo|apartado|punto)\s+([ivxlcdm]+|\d+(\.\d+)*)\b\.?|^\d+(\.\d+){1,4}\.?\s/i;

function extractClauseLabel(lineText: string): string | null {
  const match = lineText.match(CLAUSE_PATTERN);
  if (!match) return null;
  return match[0].replace(/\.?\s*$/, "").trim();
}

export async function extractStructuralDocument(buffer: Buffer): Promise<StructuralExtractionResult> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;

  const pageMarkedParts: string[] = [];
  const blocks: StructuralBlock[] = [];
  let globalOrder = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
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
    let currentClause: string | null = null;
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

    pageMarkedParts.push(`[PÁGINA ${pageNum}]\n${pageParagraphTexts.join("\n\n")}`);
    page.cleanup();
  }

  const pageCount = pdf.numPages || 1;
  await pdf.destroy();

  return {
    pageMarkedText: pageMarkedParts.join("\n\n").trim(),
    blocks,
    pageCount,
  };
}

function finalizeLine(line: { items: TextItem[]; top: number; bottom: number }, pageWidth: number): PositionedLine {
  const sortedItems = [...line.items].sort((a, b) => a.transform[4] - b.transform[4]);
  const text = sortedItems.map((i) => i.str).join(" ");
  const left = Math.min(...sortedItems.map((i) => i.transform[4]));
  const right = Math.max(...sortedItems.map((i) => i.transform[4] + (i.width || 0)));
  return { text, top: line.top, bottom: line.bottom, left, right: Math.min(right, pageWidth) };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
