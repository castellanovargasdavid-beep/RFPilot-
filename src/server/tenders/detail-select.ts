import type { Prisma } from "@prisma/client";

/**
 * Shape compartida entre la carga inicial server-side (página de detalle)
 * y el polling client-side (GET /api/tenders/[id]) — un único `select` para
 * que ambos devuelvan exactamente el mismo tipo y la UI no tenga que
 * reconciliar dos formas de datos distintas.
 */
export const tenderDetailSelect = {
  id: true,
  title: true,
  status: true,
  statusMessage: true,
  pageCount: true,
  extractedTextIsOcr: true,
  extractionMethod: true,
  fileName: true,
  fileSizeBytes: true,
  submissionDeadline: true,
  clarificationDeadline: true,
  maxBudget: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  extractionStartedAt: true,
  ocrPagesProcessed: true,
  ocrPagesTotal: true,
  analyses: {
    orderBy: { version: "desc" },
    take: 1,
    include: {
      requirements: { orderBy: { order: "asc" }, include: { eligibilityCheck: true } },
      scoringCriteria: { orderBy: { order: "asc" } },
    },
  },
} satisfies Prisma.TenderSelect;

export type TenderDetail = Prisma.TenderGetPayload<{ select: typeof tenderDetailSelect }>;
