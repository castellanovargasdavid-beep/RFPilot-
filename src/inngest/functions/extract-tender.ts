import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { fetchStoredFile } from "@/server/storage";
import { extractTenderDocument, PdfExtractionError } from "@/server/pdf";

/**
 * Pipeline paso (a): extracción de texto y estructura del PDF. Se ejecuta
 * async vía Inngest para no bloquear la request HTTP de subida — un pliego
 * de 150 páginas escaneadas puede tardar varios minutos en OCR.
 */
export const extractTenderFunction = inngest.createFunction(
  { id: "extract-tender", retries: 2 },
  { event: "tender/uploaded" },
  async ({ event, step }) => {
    const { tenderId } = event.data;

    await step.run("mark-extracting", async () => {
      await prisma.tender.update({
        where: { id: tenderId },
        data: { status: "EXTRACTING", statusMessage: null },
      });
    });

    const result = await step.run("extract-text", async () => {
      try {
        const tender = await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } });
        const buffer = await fetchStoredFile(tender.fileUrl);
        return await extractTenderDocument(buffer);
      } catch (error) {
        const message =
          error instanceof PdfExtractionError
            ? error.message
            : "Error inesperado al extraer el texto del PDF.";
        await prisma.tender.update({
          where: { id: tenderId },
          data: { status: "EXTRACTION_FAILED", statusMessage: message },
        });
        throw error;
      }
    });

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
