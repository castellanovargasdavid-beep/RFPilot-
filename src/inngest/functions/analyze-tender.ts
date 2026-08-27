import type { PliegoDocument, RequirementCertaintyLevel } from "@prisma/client";

import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { refundCredits, hasUnlimitedCredits } from "@/server/billing/credits";
import { CREDIT_COST_TENDER_ANALYSIS } from "@/lib/plans";
import { analyzePcap, PCAP_EXTRACTION_PROMPT_VERSION } from "@/ai/analyze-pcap";
import { analyzePpt, PPT_EXTRACTION_PROMPT_VERSION } from "@/ai/analyze-ppt";
import { CLAUDE_MODEL } from "@/ai/client";
import { inferLegacyCategory } from "@/ai/requirement-mapping";
import type { Referencia, NivelCerteza } from "@/ai/schemas/pcap-extraction";
import { getOrCreateDefaultProfile } from "@/server/company-profile/repository";
import { runEligibilityCrossCheck } from "@/server/eligibility/run-cross-check";
import { verifyCitation } from "@/server/pdf/verify-citation";
import type { StructuralBlock } from "@/server/pdf/structural-extract";

/**
 * Guardrail determinista: cruza la cita_literal + referencia.pagina que
 * reporta Claude contra los bloques estructurales reales del PDF (ver
 * src/server/pdf/verify-citation.ts). Si no hay bloques disponibles (p.ej.
 * el pliego cayó a OCR y no tiene bounding boxes fiables) no se puede
 * verificar nada — se marca pendiente de revisión humana igualmente, nunca
 * se asume que una cita no verificable es correcta.
 */
function checkCitation(
  citaLiteral: string,
  referencia: Referencia,
  blocks: StructuralBlock[]
): { pendienteRevisionHumana: boolean; bbox: StructuralBlock | null } {
  if (blocks.length === 0) {
    return { pendienteRevisionHumana: true, bbox: null };
  }
  const result = verifyCitation(citaLiteral, referencia.pagina, blocks);
  return { pendienteRevisionHumana: !result.verified, bbox: result.matchedBlock };
}

function clauseOrNull(clausula: string): string | null {
  return clausula.trim() ? clausula.trim() : null;
}

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

    const blocks = await step.run("load-structural-blocks", async () => {
      return prisma.tenderDocumentBlock.findMany({ where: { tenderId }, orderBy: { order: "asc" } });
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
          promptVersion: `${PCAP_EXTRACTION_PROMPT_VERSION}+${PPT_EXTRACTION_PROMPT_VERSION}`,
          modelUsed: CLAUDE_MODEL,
        },
      });
    });

    let pcapResult;
    let pptResult;
    try {
      // Secuencial (no Promise.all): la llamada del PPT reutiliza el
      // prefijo cacheado que escribe la del PCAP — en paralelo real se
      // arriesga a que la segunda petición salga antes de que el caché de
      // la primera esté disponible, perdiendo el ahorro de coste/latencia.
      pcapResult = await step.run("run-pcap-analysis", async () => {
        return analyzePcap(tender.extractedText!, tender.sourceType);
      });
      pptResult = await step.run("run-ppt-analysis", async () => {
        return analyzePpt(tender.extractedText!);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al analizar el pliego con IA.";
      await step.run("mark-analysis-failed", async () => {
        await prisma.$transaction([
          prisma.tenderAnalysis.update({ where: { id: analysis.id }, data: { status: "FAILED", errorMessage: message } }),
          prisma.tender.update({ where: { id: tenderId }, data: { status: "ANALYSIS_FAILED", statusMessage: message } }),
        ]);
        if (!(await hasUnlimitedCredits(tender.organizationId))) {
          await refundCredits(tender.organizationId, CREDIT_COST_TENDER_ANALYSIS, tenderId);
        }
      });
      throw error;
    }

    await step.run("verify-citations-and-persist", async () => {
      const { extraction: pcap, usage: pcapUsage } = pcapResult;
      const { extraction: ppt, usage: pptUsage } = pptResult;

      const exclusionRequirementsData = [
        ...pcap.requisitos.map((req, index) => {
          const { pendienteRevisionHumana, bbox } = checkCitation(req.cita_literal, req.referencia, blocks);
          return {
            analysisId: analysis.id,
            category: inferLegacyCategory(req.tipo, req.descripcion, req.cita_literal),
            description: req.descripcion,
            citationText: req.cita_literal,
            citationPage: req.referencia.pagina,
            citationClause: clauseOrNull(req.referencia.clausula),
            isMandatory: req.es_excluyente,
            order: index,
            tipo: req.tipo,
            esExcluyente: req.es_excluyente,
            documentoPliego: req.referencia.pliego as PliegoDocument,
            nivelCerteza: req.nivel_certeza as NivelCerteza,
            pendienteRevisionHumana,
            bboxX: bbox?.bboxX ?? null,
            bboxY: bbox?.bboxY ?? null,
            bboxW: bbox?.bboxW ?? null,
            bboxH: bbox?.bboxH ?? null,
          };
        }),
        ...ppt.requisitosTecnicos.map((req, index) => {
          const { pendienteRevisionHumana, bbox } = checkCitation(req.cita_literal, req.referencia, blocks);
          return {
            analysisId: analysis.id,
            category: inferLegacyCategory(req.tipo, req.descripcion, req.cita_literal),
            description: req.descripcion,
            citationText: req.cita_literal,
            citationPage: req.referencia.pagina,
            citationClause: clauseOrNull(req.referencia.clausula),
            isMandatory: req.es_excluyente,
            order: pcap.requisitos.length + index,
            tipo: req.tipo,
            esExcluyente: req.es_excluyente,
            documentoPliego: req.referencia.pliego as PliegoDocument,
            nivelCerteza: req.nivel_certeza as NivelCerteza,
            pendienteRevisionHumana,
            bboxX: bbox?.bboxX ?? null,
            bboxY: bbox?.bboxY ?? null,
            bboxW: bbox?.bboxW ?? null,
            bboxH: bbox?.bboxH ?? null,
          };
        }),
      ];

      const scoringCriteriaData = ppt.criteriosAdjudicacion.map((c, index) => {
        const citation =
          c.cita_literal && c.referencia ? checkCitation(c.cita_literal, c.referencia, blocks) : { pendienteRevisionHumana: false, bbox: null };
        return {
          analysisId: analysis.id,
          name: c.nombre,
          description: c.descripcion,
          weightPercent: c.weightPercent,
          maxPoints: c.maxPoints,
          order: index,
          citationText: c.cita_literal,
          citationPage: c.referencia?.pagina ?? null,
          citationClause: c.referencia ? clauseOrNull(c.referencia.clausula) : null,
          documentoPliego: (c.referencia?.pliego as PliegoDocument | undefined) ?? null,
          nivelCerteza: c.nivel_certeza as RequirementCertaintyLevel,
          pendienteRevisionHumana: citation.pendienteRevisionHumana,
          bboxX: citation.bbox?.bboxX ?? null,
          bboxY: citation.bbox?.bboxY ?? null,
          bboxW: citation.bbox?.bboxW ?? null,
          bboxH: citation.bbox?.bboxH ?? null,
        };
      });

      await prisma.$transaction([
        prisma.exclusionRequirement.createMany({ data: exclusionRequirementsData }),
        prisma.scoringCriterion.createMany({ data: scoringCriteriaData }),
        prisma.tenderAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: "COMPLETED",
            scopeSummary: pcap.executiveSummary.scopeSummary,
            executiveSummaryJson: pcap.executiveSummary,
            requirementsSectionUnclear: pcap.requirementsSectionUnclear,
          },
        }),
        prisma.tender.update({
          where: { id: tenderId },
          data: {
            status: "READY",
            statusMessage: null,
            submissionDeadline: pcap.executiveSummary.submissionDeadline
              ? new Date(pcap.executiveSummary.submissionDeadline)
              : null,
            clarificationDeadline: pcap.executiveSummary.clarificationDeadline
              ? new Date(pcap.executiveSummary.clarificationDeadline)
              : null,
            maxBudget: pcap.executiveSummary.maxBudget,
            currency: pcap.executiveSummary.currency || "EUR",
          },
        }),
        prisma.aiUsageLog.create({
          data: {
            organizationId: tender.organizationId,
            tenderId,
            userId: tender.uploadedById,
            step: "pcap-extraction",
            model: pcapUsage.model,
            inputTokens: pcapUsage.inputTokens,
            outputTokens: pcapUsage.outputTokens,
            cacheReadTokens: pcapUsage.cacheReadTokens,
            cacheWriteTokens: pcapUsage.cacheWriteTokens,
            costCents: pcapUsage.costCents,
            durationMs: pcapUsage.durationMs,
          },
        }),
        prisma.aiUsageLog.create({
          data: {
            organizationId: tender.organizationId,
            tenderId,
            userId: tender.uploadedById,
            step: "ppt-extraction",
            model: pptUsage.model,
            inputTokens: pptUsage.inputTokens,
            outputTokens: pptUsage.outputTokens,
            cacheReadTokens: pptUsage.cacheReadTokens,
            cacheWriteTokens: pptUsage.cacheWriteTokens,
            costCents: pptUsage.costCents,
            durationMs: pptUsage.durationMs,
          },
        }),
      ]);
    });

    // Paso (c): cruce automático contra el perfil de empresa por defecto de
    // la organización (Fase 4). Es código determinista, no otra llamada a
    // Claude — barato, así que se ejecuta siempre, aunque el perfil esté
    // vacío (el usuario verá el semáforo en rojo/ámbar y sabrá qué rellenar).
    await step.run("run-eligibility-cross-check", async () => {
      const profile = await getOrCreateDefaultProfile(tender.organizationId);
      await runEligibilityCrossCheck(tenderId, profile.id);
    });

    return { tenderId, analysisId: analysis.id };
  }
);
