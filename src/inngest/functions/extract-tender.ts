import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { fetchStoredFile } from "@/server/storage";
import { PdfExtractionError, type TenderExtractionResult } from "@/server/pdf";
import { extractPdfTextRange, SCANNED_HEURISTIC_CHARS_PER_PAGE } from "@/server/pdf/extract-text";
import { extractStructuralDocument, type StructuralBlock } from "@/server/pdf/structural-extract";
import { MAX_OCR_PAGES, ocrSinglePageStructured } from "@/server/pdf/ocr";

/**
 * Páginas por step para el texto nativo y la indexación estructural — igual
 * motivo que el OCR troceado por página: un pliego grande puede tardar más
 * de los 60s de una función serverless en plan Hobby de Vercel incluso solo
 * para leer su capa de texto, antes de saber siquiera si hace falta OCR.
 */
const TEXT_BATCH_SIZE = 10;

async function loadTenderBuffer(tenderId: string): Promise<Buffer> {
  const tender = await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } });
  return fetchStoredFile(tender.fileUrl);
}

async function markExtractionFailed(tenderId: string, message: string): Promise<void> {
  await prisma.tender.update({
    where: { id: tenderId },
    data: { status: "EXTRACTION_FAILED", statusMessage: message },
  });
}

/**
 * Pipeline paso (a): extracción de texto y estructura del PDF. Se ejecuta
 * async vía Inngest para no bloquear la request HTTP de subida.
 *
 * Tanto el texto nativo como la indexación estructural y el OCR de un
 * pliego escaneado van troceados en steps por lotes de páginas (en vez de
 * un único step que procese todo el documento de una vez): en plan Hobby
 * de Vercel cada invocación serverless tiene solo 60s (ver maxDuration en
 * src/app/api/inngest/route.ts), y un PDF grande puede superarlo incluso
 * solo leyendo su capa de texto. Con un step por lote, cada invocación
 * individual solo hace el trabajo de unas pocas páginas — y si Vercel mata
 * una invocación a mitad, Inngest reintenta solo ese lote, no el documento
 * entero desde cero.
 */
export const extractTenderFunction = inngest.createFunction(
  { id: "extract-tender", retries: 2 },
  { event: "tender/uploaded" },
  async ({ event, step }) => {
    const { tenderId } = event.data;

    await step.run("mark-extracting", async () => {
      await prisma.tender.update({
        where: { id: tenderId },
        data: {
          status: "EXTRACTING",
          statusMessage: null,
          extractionStartedAt: new Date(),
          ocrPagesProcessed: null,
          ocrPagesTotal: null,
        },
      });
    });

    let pageCount: number;
    let charsPerPage: number;
    const nativeTextParts: string[] = [];

    try {
      let totalChars = 0;
      let knownPageCount: number | null = null;
      let batchStart = 1;
      let batchIndex = 0;

      do {
        const batch = await step.run(`extract-text-batch-${batchIndex}`, async () => {
          const buffer = await loadTenderBuffer(tenderId);
          return extractPdfTextRange(buffer, batchStart, batchStart + TEXT_BATCH_SIZE - 1);
        });
        knownPageCount = batch.pageCount;
        totalChars += batch.charCount;
        nativeTextParts.push(batch.text);
        batchStart += TEXT_BATCH_SIZE;
        batchIndex++;
      } while (batchStart <= knownPageCount);

      pageCount = knownPageCount;
      charsPerPage = totalChars / pageCount;
    } catch (error) {
      const message = "No se pudo leer el PDF: el archivo parece corrupto o no es un PDF válido.";
      await markExtractionFailed(tenderId, message);
      throw new PdfExtractionError(message, { cause: error });
    }

    const looksScanned = charsPerPage < SCANNED_HEURISTIC_CHARS_PER_PAGE;
    let result: TenderExtractionResult;

    if (!looksScanned) {
      const structuralBlocks: StructuralBlock[] = [];
      const pageMarkedParts: string[] = [];
      let clause: string | null = null;
      let orderOffset = 0;
      let structuralOk = true;

      try {
        let sBatchStart = 1;
        let sBatchIndex = 0;
        while (sBatchStart <= pageCount) {
          const structBatch = await step.run(`extract-structural-batch-${sBatchIndex}`, async () => {
            const buffer = await loadTenderBuffer(tenderId);
            return extractStructuralDocument(buffer, {
              startPage: sBatchStart,
              endPage: sBatchStart + TEXT_BATCH_SIZE - 1,
              initialClause: clause,
              orderOffset,
            });
          });
          structuralBlocks.push(...structBatch.blocks);
          pageMarkedParts.push(structBatch.pageMarkedText);
          clause = structBatch.endClause;
          orderOffset += structBatch.blocks.length;
          sBatchStart += TEXT_BATCH_SIZE;
          sBatchIndex++;
        }
      } catch {
        // La indexación estructural es una mejora, no un requisito — si
        // falla a mitad, seguimos con el texto plano ya extraído; el
        // guardrail simplemente no podrá verificar citas.
        structuralOk = false;
      }

      result = {
        text: structuralOk ? pageMarkedParts.join("\n\n").trim() : nativeTextParts.join("\n\n").trim(),
        pageCount,
        usedOcr: false,
        extractionMethod: "pdfjs-text",
        structuralBlocks: structuralOk ? structuralBlocks : [],
      };
    } else {
      const pagesToProcess = Math.min(pageCount, MAX_OCR_PAGES);
      const pageTexts: string[] = [];
      const ocrBlocks: StructuralBlock[] = [];
      let clause: string | null = null;
      let orderOffset = 0;

      await step.run("init-ocr-progress", async () => {
        await prisma.tender.update({
          where: { id: tenderId },
          data: { ocrPagesProcessed: 0, ocrPagesTotal: pagesToProcess },
        });
      });

      try {
        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
          const pageResult = await step.run(`ocr-page-${pageNum}`, async () => {
            const buffer = await loadTenderBuffer(tenderId);
            const result = await ocrSinglePageStructured(buffer, pageNum, clause, orderOffset);
            await prisma.tender.update({
              where: { id: tenderId },
              data: { ocrPagesProcessed: pageNum },
            });
            return result;
          });
          pageTexts.push(pageResult.text);
          ocrBlocks.push(...pageResult.blocks);
          clause = pageResult.endClause;
          orderOffset += pageResult.blocks.length;
        }
      } catch (error) {
        const message =
          pageTexts.length > 0
            ? "El pliego parece un documento escaneado y el OCR falló a mitad de proceso; el texto extraído puede estar incompleto."
            : "El pliego parece un documento escaneado (sin texto extraíble) y el OCR también falló. Prueba a subir una versión con texto seleccionable.";
        if (pageTexts.length === 0) {
          await markExtractionFailed(tenderId, message);
          throw new PdfExtractionError(message, { cause: error });
        }
        // Con al menos una página de OCR ya lista, seguimos con lo que hay
        // en vez de perder todo el progreso — igual que hacía el camino
        // monolítico anterior cuando el OCR fallaba a medias.
      }

      const truncated = pageCount > MAX_OCR_PAGES;
      result = {
        text: pageTexts.join("\n\n"),
        pageCount,
        usedOcr: true,
        extractionMethod: "tesseract-ocr",
        warning: truncated
          ? `El documento tiene ${pageCount} páginas escaneadas; por límite de procesamiento solo se analizaron por OCR las primeras ${pagesToProcess}.`
          : undefined,
        structuralBlocks: ocrBlocks,
      };
    }

    await step.run("save-extraction", async () => {
      await prisma.$transaction([
        prisma.tender.update({
          where: { id: tenderId },
          data: {
            status: "EXTRACTED",
            statusMessage: result.warning ?? null,
            extractedText: result.text,
            extractedTextIsOcr: result.usedOcr,
            extractionMethod: result.extractionMethod,
            pageCount: result.pageCount,
          },
        }),
        prisma.tenderDocumentBlock.deleteMany({ where: { tenderId } }),
        ...(result.structuralBlocks.length > 0
          ? [
              prisma.tenderDocumentBlock.createMany({
                data: result.structuralBlocks.map((block) => ({
                  tenderId,
                  documento: "PCAP" as const,
                  pagina: block.pagina,
                  clausula: block.clausula,
                  parrafo: block.parrafo,
                  text: block.text,
                  bboxX: block.bboxX,
                  bboxY: block.bboxY,
                  bboxW: block.bboxW,
                  bboxH: block.bboxH,
                  order: block.order,
                  esTabla: block.esTabla,
                })),
              }),
            ]
          : []),
      ]);
    });

    await step.sendEvent("notify-extraction-completed", {
      name: "tender/extraction.completed",
      data: { tenderId },
    });

    return { tenderId, pageCount: result.pageCount, usedOcr: result.usedOcr };
  }
);
