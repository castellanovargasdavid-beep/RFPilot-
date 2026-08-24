import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { refundCredits } from "@/server/billing/credits";
import { CREDIT_COST_TENDER_ANALYSIS } from "@/lib/plans";
import { analyzeTenderRequirements, REQUIREMENTS_EXTRACTION_PROMPT_VERSION } from "@/ai/analyze-tender";
import { CLAUDE_MODEL } from "@/ai/client";

/**
 * Pipeline paso (b): extracción de requisitos excluyentes + criterios de
 * baremo + resumen ejecutivo. El crédito ya se ha descontado de forma
 * síncrona en la API route que dispara este evento (mejor UX: el usuario
 * ve el saldo actualizado al instante) — si el análisis falla
 * irrecuperablemente, esta función lo reembolsa.
 */
export const analyzeTenderFunction = inngest.createFunction(
  { id: "analyze-tender", retries: 1 },
  { event: "tender/analysis.requested" },
  async ({ event, step }) => {
    const { tenderId } = event.data;

    const tender = await step.run("load-tender", async () => {
      const t = await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } });
      if (!t.extractedText) {
        throw new Error("El pliego no tiene texto extraído todavía.");
      }
      return t;
    });

    const analysis = await step.run("create-analysis-version", async () => {
      const lastVersion = await prisma.tenderAnalysis.findFirst({
        where: { tenderId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      return prisma.tenderAnalysis.create({
        data: {
          tenderId,
          version: (lastVersion?.version ?? 0) + 1,
          status: "RUNNING",
          promptVersion: REQUIREMENTS_EXTRACTION_PROMPT_VERSION,
          modelUsed: CLAUDE_MODEL,
        },
      });
    });

    let result;
    try {
      result = await step.run("run-claude-analysis", async () => {
        return analyzeTenderRequirements(tender.extractedText!, tender.sourceType);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al analizar el pliego con IA.";
      await step.run("mark-analysis-failed", async () => {
        await prisma.$transaction([
          prisma.tenderAnalysis.update({ where: { id: analysis.id }, data: { status: "FAILED", errorMessage: message } }),
          prisma.tender.update({ where: { id: tenderId }, data: { status: "ANALYSIS_FAILED", statusMessage: message } }),
        ]);
        await refundCredits(tender.organizationId, CREDIT_COST_TENDER_ANALYSIS, tenderId);
      });
      throw error;
    }

    await step.run("persist-results", async () => {
      const { extraction, usage } = result;

      await prisma.$transaction([
        prisma.exclusionRequirement.createMany({
          data: extraction.exclusionRequirements.map((req, index) => ({
            analysisId: analysis.id,
            category: req.category,
            description: req.description,
            citationText: req.citationText,
            citationPage: req.citationPage,
            citationClause: req.citationClause,
            isMandatory: req.isMandatory,
            order: index,
          })),
        }),
        prisma.scoringCriterion.createMany({
          data: extraction.scoringCriteria.map((c, index) => ({
            analysisId: analysis.id,
            name: c.name,
            description: c.description,
            weightPercent: c.weightPercent,
            maxPoints: c.maxPoints,
            order: index,
          })),
        }),
        prisma.tenderAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: "COMPLETED",
            scopeSummary: extraction.executiveSummary.scopeSummary,
            executiveSummaryJson: extraction.executiveSummary,
            requirementsSectionUnclear: extraction.requirementsSectionUnclear,
          },
        }),
        prisma.tender.update({
          where: { id: tenderId },
          data: {
            status: "READY",
            statusMessage: null,
            submissionDeadline: extraction.executiveSummary.submissionDeadline
              ? new Date(extraction.executiveSummary.submissionDeadline)
              : null,
            clarificationDeadline: extraction.executiveSummary.clarificationDeadline
              ? new Date(extraction.executiveSummary.clarificationDeadline)
              : null,
            maxBudget: extraction.executiveSummary.maxBudget,
            currency: extraction.executiveSummary.currency || "EUR",
          },
        }),
        prisma.aiUsageLog.create({
          data: {
            organizationId: tender.organizationId,
            tenderId,
            userId: tender.uploadedById,
            step: "requirements-extraction",
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
            costCents: usage.costCents,
            durationMs: usage.durationMs,
          },
        }),
      ]);
    });

    return { tenderId, analysisId: analysis.id };
  }
);
