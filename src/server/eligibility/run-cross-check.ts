import { prisma } from "@/lib/prisma";
import { getProfileForEligibility } from "@/server/company-profile/repository";
import { evaluateAllRequirements, rollupEligibility, type EligibilityRollup } from "./engine";
import type { EligibilityContext } from "./types";

export class NoCompletedAnalysisError extends Error {
  constructor() {
    super("No hay un análisis completado para esta licitación.");
  }
}

export class CompanyProfileNotFoundError extends Error {
  constructor() {
    super("Perfil de empresa no encontrado.");
  }
}

/**
 * Paso (c) del pipeline: cruza los requisitos ya extraídos (Fase 3) contra
 * el perfil de empresa y persiste el semáforo. Es código síncrono y
 * determinista (ver src/server/eligibility/engine.ts) — no dispara ninguna
 * llamada a Claude, así que se puede volver a ejecutar gratis cada vez que
 * el usuario actualiza su perfil.
 */
export async function runEligibilityCrossCheck(tenderId: string, companyProfileId: string): Promise<EligibilityRollup> {
  const tender = await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } });

  const analysis = await prisma.tenderAnalysis.findFirst({
    where: { tenderId, status: "COMPLETED" },
    orderBy: { version: "desc" },
    include: { requirements: true },
  });
  if (!analysis) throw new NoCompletedAnalysisError();

  const profile = await getProfileForEligibility(companyProfileId, tender.organizationId);
  if (!profile) throw new CompanyProfileNotFoundError();

  const context: EligibilityContext = { submissionDeadline: tender.submissionDeadline };
  const requirements = analysis.requirements.map((r) => ({
    id: r.id,
    category: r.category,
    description: r.description,
    citationText: r.citationText,
    isMandatory: r.isMandatory,
    pendienteRevisionHumana: r.pendienteRevisionHumana,
  }));

  const results = evaluateAllRequirements(requirements, profile, context);
  const rollup = rollupEligibility(results, requirements);

  await prisma.$transaction([
    ...results.map((result) =>
      prisma.eligibilityCheck.upsert({
        where: { requirementId: result.requirementId },
        create: {
          analysisId: analysis.id,
          requirementId: result.requirementId,
          status: result.status,
          reasoning: result.reasoning,
          matchedProfileFact: result.matchedProfileFact,
        },
        update: {
          status: result.status,
          reasoning: result.reasoning,
          matchedProfileFact: result.matchedProfileFact,
        },
      })
    ),
    prisma.tenderAnalysis.update({
      where: { id: analysis.id },
      data: { eligibilityStatus: rollup.status, eligibilityScore: rollup.score, companyProfileId },
    }),
  ]);

  return rollup;
}
