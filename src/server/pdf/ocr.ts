import { tmpdir } from "os";
import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import spaTrainedData from "@tesseract.js-data/spa";

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
const MAX_OCR_PAGES = 40;
const RENDER_SCALE = 2;

export interface OcrResult {
  text: string;
  pagesProcessed: number;
  totalPages: number;
  truncated: boolean;
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

export async function ocrPdfBuffer(
  buffer: Buffer,
  onProgress?: (pageNum: number, totalPages: number) => void
): Promise<OcrResult> {
  const canvasFactory = new NodeCanvasFactory();
  const data = new Uint8Array(buffer);
  // `canvasFactory` renderiza en Node vía @napi-rs/canvas; es una opción real
  // en runtime que los tipos de pdfjs-dist no reflejan para esta versión.
  const loadingTask = getDocument({
    data,
    isEvalSupported: false,
    canvasFactory,
  } as Parameters<typeof getDocument>[0] & { canvasFactory: NodeCanvasFactory });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const pagesToProcess = Math.min(totalPages, MAX_OCR_PAGES);

  const worker = await createWorker("spa", 1, {
    langPath: spaTrainedData.langPath,
    gzip: true,
    cachePath: tmpdir(),
  });

  const pageTexts: string[] = [];
  try {
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

      const renderParams = {
        canvasContext: canvasAndContext.context as unknown as CanvasRenderingContext2D,
        viewport,
        canvasFactory,
      };
      await page.render(renderParams as unknown as Parameters<typeof page.render>[0]).promise;

      const imageBuffer = canvasAndContext.canvas.toBuffer("image/png");
      const { data: ocrData } = await worker.recognize(imageBuffer);
      pageTexts.push(`--- Página ${pageNum} ---\n${ocrData.text.trim()}`);

      canvasFactory.destroy(canvasAndContext);
      page.cleanup();
      onProgress?.(pageNum, pagesToProcess);
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }

  return {
    text: pageTexts.join("\n\n"),
    pagesProcessed: pagesToProcess,
    totalPages,
    truncated: totalPages > MAX_OCR_PAGES,
  };
}
