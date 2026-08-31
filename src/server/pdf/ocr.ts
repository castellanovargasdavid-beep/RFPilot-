import { tmpdir } from "os";
import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import "./setup-worker";
import { createWorker } from "tesseract.js";
import type Tesseract from "tesseract.js";
import spaTrainedData from "@tesseract.js-data/spa";
import { countBigHorizontalGaps, groupLinesIntoParagraphs, type PositionedLine, type StructuralBlock } from "./structural-extract";

/**
 * Fallback OCR para pliegos escaneados (sin capa de texto). Renderiza cada
 * página a PNG con pdfjs-dist + @napi-rs/canvas (binarios prebuilt, sin
 * dependencias nativas de sistema como cairo/pango) y la pasa por
 * Tesseract.js (WASM puro). El modelo de idioma va empaquetado como
 * dependencia npm (@tesseract.js-data/spa) en vez de descargarse de un CDN
 * en cada cold start: es más rápido, más fiable, y funciona detrás de
 * proxies/egress restrictivo.
 *
 * Tesseract.js puro es notablemente más lento que un servicio de OCR en la
 * nube — para pliegos escaneados muy largos, limitamos el nº de páginas
 * procesadas (ver MAX_OCR_PAGES) y lo dejamos documentado como límite
 * conocido; migrar a un proveedor de OCR gestionado es la vía natural de
 * escalar esto si se vuelve un cuello de botella real.
 */
export const MAX_OCR_PAGES = 40;
const RENDER_SCALE = 2;
/**
 * Un escaneo de página muy grande o muy alta resolución (ej. A3 a 600dpi)
 * puede generar, a RENDER_SCALE fijo, una imagen enorme — Tesseract.js
 * sobre esa imagen puede tardar bastante más de los 60s de una sola
 * página, incluso con el troceado por página (ver ocrSinglePage). Este
 * tope evita eso: nunca se renderiza a más de este tamaño en el lado
 * largo, escalando hacia abajo solo cuando hace falta (páginas normales,
 * a RENDER_SCALE=2, quedan muy por debajo y no se ven afectadas).
 */
const MAX_RENDER_DIMENSION_PX = 2000;

/**
 * Binarización con umbral de Otsu antes de pasar la página por Tesseract —
 * mejora medible en escaneos de mala calidad (contraste bajo, sombras de
 * escáner, papel amarillento): calcula el umbral de gris que mejor separa
 * texto de fondo a partir del histograma de la propia imagen (en vez de un
 * umbral fijo, que funciona bien en unos escaneos y mal en otros) y
 * convierte cada píxel a blanco o negro puro. Ver ARCHITECTURE.md §
 * Robustez de extracción.
 */
function computeOtsuThreshold(histogram: number[], totalPixels: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumB += t * histogram[t];
    const meanBackground = sumB / weightBackground;
    const meanForeground = (sum - sumB) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}

function preprocessForOcr(canvas: Canvas, context: SKRSContext2D): void {
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  const grayscale = new Uint8ClampedArray(width * height);
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grayscale[i / 4] = gray;
    histogram[gray]++;
  }

  const threshold = computeOtsuThreshold(histogram, width * height);

  for (let i = 0; i < grayscale.length; i++) {
    const value = grayscale[i] > threshold ? 255 : 0;
    const offset = i * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
}

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: Canvas; context: SKRSContext2D }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: Canvas | null; context: SKRSContext2D | null }) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function loadPdfForOcr(buffer: Buffer, canvasFactory: NodeCanvasFactory) {
  const data = new Uint8Array(buffer);
  // `canvasFactory` renderiza en Node vía @napi-rs/canvas; es una opción real
  // en runtime que los tipos de pdfjs-dist no reflejan para esta versión.
  const loadingTask = getDocument({
    data,
    isEvalSupported: false,
    canvasFactory,
  } as Parameters<typeof getDocument>[0] & { canvasFactory: NodeCanvasFactory });
  return loadingTask.promise;
}

interface RecognizedPage {
  text: string;
  /** Líneas detectadas por Tesseract con su bbox en píxeles de la imagen renderizada (ver imageWidth/imageHeight) — la base para construir StructuralBlock[] igual que la capa de texto nativa (ver groupLinesIntoParagraphs). */
  lines: Tesseract.Line[];
  imageWidth: number;
  imageHeight: number;
}

async function renderAndRecognizePage(
  pdf: Awaited<ReturnType<typeof loadPdfForOcr>>,
  canvasFactory: NodeCanvasFactory,
  pageNum: number,
  worker: Awaited<ReturnType<typeof createWorker>>
): Promise<RecognizedPage> {
  const page = await pdf.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(baseViewport.width, baseViewport.height);
  const effectiveScale = Math.min(RENDER_SCALE, MAX_RENDER_DIMENSION_PX / longestSide);
  const viewport = page.getViewport({ scale: effectiveScale });
  const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

  const renderParams = {
    canvasContext: canvasAndContext.context as unknown as CanvasRenderingContext2D,
    viewport,
    canvasFactory,
  };
  await page.render(renderParams as unknown as Parameters<typeof page.render>[0]).promise;
  preprocessForOcr(canvasAndContext.canvas, canvasAndContext.context);

  const imageBuffer = canvasAndContext.canvas.toBuffer("image/png");
  const { data: ocrData } = await worker.recognize(imageBuffer);

  const imageWidth = canvasAndContext.canvas.width;
  const imageHeight = canvasAndContext.canvas.height;
  canvasFactory.destroy(canvasAndContext);
  page.cleanup();

  return { text: ocrData.text.trim(), lines: ocrData.lines ?? [], imageWidth, imageHeight };
}

/**
 * Convierte las líneas de Tesseract (ya en orden de lectura, con bbox en
 * píxeles) al mismo PositionedLine que usa la capa de texto nativa, para
 * poder pasarlas por groupLinesIntoParagraphs y obtener bloques con la
 * misma granularidad — un párrafo por salto de cláusula o hueco vertical,
 * no "toda la página como un único bloque" (que es lo que da la propia
 * segmentación de párrafos de Tesseract sobre un documento denso a una
 * columna, verificado empíricamente contra un pliego real).
 */
function toPositionedLines(lines: Tesseract.Line[]): PositionedLine[] {
  return lines
    .map((line) => {
      const text = line.text.trim();
      if (!text) return null;
      const lineHeight = line.bbox.y1 - line.bbox.y0 || 10;
      const sortedWords = [...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const edges = sortedWords.map((w) => ({ left: w.bbox.x0, right: w.bbox.x1 }));
      const bigGaps = countBigHorizontalGaps(edges, lineHeight);
      return {
        text,
        top: line.bbox.y0,
        bottom: line.bbox.y1,
        left: line.bbox.x0,
        right: line.bbox.x1,
        looksLikeTableRow: bigGaps >= 2,
      };
    })
    .filter((line): line is PositionedLine => line !== null);
}

/**
 * Nº de páginas del PDF, sin renderizar ni hacer OCR — para decidir cuántas
 * páginas tocan (Math.min(totalPages, MAX_OCR_PAGES)) antes de arrancar el
 * troceado por página en Inngest (ver ocrSinglePage y
 * src/inngest/functions/extract-tender.ts).
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  await pdf.destroy();
  return numPages;
}

function formatPageText(pageNum: number, text: string): string {
  return `--- Página ${pageNum} ---\n${text}`;
}

export interface OcrPageResult {
  text: string;
  blocks: StructuralBlock[];
  endClause: string | null;
}

/**
 * OCR de una única página, con bloques estructurales (bbox incluido) —
 * existe para poder trocear un pliego escaneado largo en un step de
 * Inngest por página: cada llamada es una invocación serverless
 * independiente con su propio presupuesto de tiempo (60s en plan Hobby de
 * Vercel — ver maxDuration en src/app/api/inngest/route.ts), así que
 * ninguna página individual puede agotarlo aunque el documento entero
 * (hasta MAX_OCR_PAGES páginas) sí lo haría en un único paso. Recarga el
 * PDF y crea un worker de Tesseract nuevos en cada llamada (no hay estado
 * compartido entre invocaciones serverless distintas) — el coste de esa
 * recarga es aceptable frente al beneficio de no perder todo el progreso
 * si Vercel mata la función a mitad de un documento largo.
 *
 * `initialClause`/`orderOffset` funcionan igual que en
 * extractStructuralDocument: pásale el `endClause` y el nº de bloques ya
 * generados de la página anterior para que la cláusula vigente y el
 * `order` sean coherentes a través de páginas.
 */
export async function ocrSinglePageStructured(
  buffer: Buffer,
  pageNum: number,
  initialClause: string | null,
  orderOffset: number
): Promise<OcrPageResult> {
  const canvasFactory = new NodeCanvasFactory();
  const pdf = await loadPdfForOcr(buffer, canvasFactory);
  const worker = await createWorker("spa", 1, {
    langPath: spaTrainedData.langPath,
    gzip: true,
    cachePath: tmpdir(),
  });

  try {
    const page = await renderAndRecognizePage(pdf, canvasFactory, pageNum, worker);
    const positionedLines = toPositionedLines(page.lines);
    const { blocks, endClause } = groupLinesIntoParagraphs(
      positionedLines,
      pageNum,
      page.imageWidth,
      page.imageHeight,
      initialClause,
      orderOffset
    );
    return { text: formatPageText(pageNum, page.text), blocks, endClause };
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
}
