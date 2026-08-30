import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { fetchStoredFile } from "@/server/storage";
import { PdfExtractionError, type TenderExtractionResult } from "@/server/pdf";
import { extractPdfText } from "@/server/pdf/extract-text";
import { extractStructuralDocument } from "@/server/pdf/structural-extract";
import { MAX_OCR_PAGES, ocrSinglePage } from "@/server/pdf/ocr";

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
 * El OCR de un pliego escaneado va troceado en un step por página (en vez
 * de un único step que procese las hasta MAX_OCR_PAGES páginas de una
 * vez): en plan Hobby de Vercel cada invocación serverless tiene solo 60s
 * (ver maxDuration en src/app/api/inngest/route.ts), y Tesseract.js puede
 * tardar varios minutos en un documento largo. Con un step por página,
 * cada invocación individual solo hace el trabajo de una página — y si
 * Vercel mata una invocación a mitad, Inngest reintenta solo esa página
 * (no todo el documento desde cero).
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

    const nativeResult = await step.run("extract-native-text", async () => {
      try {
        const buffer = await loadTenderBuffer(tenderId);
        return await extractPdfText(buffer);
      } catch (error) {
        const message = "No se pudo leer el PDF: el archivo parece corrupto o no es un PDF válido.";
        await markExtractionFailed(tenderId, message);
        throw new PdfExtractionError(message, { cause: error });
      }
    });

    let result: TenderExtractionResult;

    if (!nativeResult.looksScanned) {
      result = await step.run("extract-structural", async () => {
        let structuralBlocks: TenderExtractionResult["structuralBlocks"] = [];
        let pageMarkedText = nativeResult.text;
        try {
          const buffer = await loadTenderBuffer(tenderId);
          const structural = await extractStructuralDocument(buffer);
          structuralBlocks = structural.blocks;
          pageMarkedText = structural.pageMarkedText;
        } catch {
          // La indexación estructural es una mejora, no un requisito — si
          // falla, seguimos con el texto plano ya extraído; el guardrail
          // simplemente no podrá verificar citas.
        }

        return {
          text: pageMarkedText,
          pageCount: nativeResult.pageCount,
          usedOcr: false,
          extractionMethod: "pdfjs-text" as const,
          structuralBlocks,
        };
      });
    } else {
      const pagesToProcess = Math.min(nativeResult.pageCount, MAX_OCR_PAGES);
      const pageTexts: string[] = [];

      await step.run("init-ocr-progress", async () => {
        await prisma.tender.update({
          where: { id: tenderId },
          data: { ocrPagesProcessed: 0, ocrPagesTotal: pagesToProcess },
        });
      });

      try {
        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
          const pageText = await step.run(`ocr-page-${pageNum}`, async () => {
            const buffer = await loadTenderBuffer(tenderId);
            const text = await ocrSinglePage(buffer, pageNum);
            await prisma.tender.update({
              where: { id: tenderId },
              data: { ocrPagesProcessed: pageNum },
            });
            return text;
          });
          pageTexts.push(pageText);
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

      const truncated = nativeResult.pageCount > MAX_OCR_PAGES;
      result = {
        text: pageTexts.join("\n\n"),
        pageCount: nativeResult.pageCount,
        usedOcr: true,
        extractionMethod: "tesseract-ocr",
        warning: truncated
          ? `El documento tiene ${nativeResult.pageCount} páginas escaneadas; por límite de procesamiento solo se analizaron por OCR las primeras ${pagesToProcess}.`
          : undefined,
        structuralBlocks: [],
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
