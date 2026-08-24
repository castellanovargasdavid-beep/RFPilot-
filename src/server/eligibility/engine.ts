import type { RequirementCategory } from "@prisma/client";

import { matchCertificationRequirement } from "./matchers/certification";
import { matchFinancialRequirement } from "./matchers/financial";
import { matchTechnicalExperienceRequirement } from "./matchers/technical-experience";
import { matchTeamQualificationRequirement } from "./matchers/team-qualification";
import { matchUnverifiableRequirement } from "./matchers/fallback";
import type {
  EligibilityCompanyProfile,
  EligibilityContext,
  EligibilityRequirement,
  EligibilityResult,
  RequirementMatcher,
} from "./types";

/**
 * Motor de cruce perfil↔requisitos — lógica de negocio más crítica del
 * producto (un falso "cumples" le puede costar la licitación al cliente).
 * Deterministic-first: cada categoría de requisito tiene un matcher en
 * TypeScript que razona sobre datos ya estructurados del perfil, sin
 * volver a llamar a Claude por cada requisito (más rápido, más barato, y
 * sobre todo más auditable/testeable que delegarlo en un LLM).
 *
 * Principio de diseño: ante la duda, AMBER, nunca GREEN. Un matcher que no
 * tiene datos suficientes para confirmar el cumplimiento nunca lo asume.
 */
const MATCHERS: Record<RequirementCategory, RequirementMatcher> = {
  CERTIFICATION: matchCertificationRequirement,
  FINANCIAL: matchFinancialRequirement,
  TECHNICAL_EXPERIENCE: matchTechnicalExperienceRequirement,
  TEAM_QUALIFICATION: matchTeamQualificationRequirement,
  LEGAL_ADMINISTRATIVE: matchUnverifiableRequirement,
  INSURANCE: matchUnverifiableRequirement,
  OTHER: matchUnverifiableRequirement,
};

export function evaluateRequirement(
  requirement: EligibilityRequirement,
  profile: EligibilityCompanyProfile,
  context: EligibilityContext
): EligibilityResult {
  const matcher = MATCHERS[requirement.category] ?? matchUnverifiableRequirement;
  return matcher(requirement, profile, context);
}

export function evaluateAllRequirements(
  requirements: EligibilityRequirement[],
  profile: EligibilityCompanyProfile,
  context: EligibilityContext
): EligibilityResult[] {
  return requirements.map((requirement) => evaluateRequirement(requirement, profile, context));
}

export interface EligibilityRollup {
  status: "GREEN" | "AMBER" | "RED";
  score: number;
}

/**
 * Semáforo global: RED si CUALQUIER requisito excluyente obligatorio es
 * RED (basta uno para descartar la licitación), AMBER si no hay ningún RED
 * pero sí algún AMBER, GREEN solo si todos los obligatorios son GREEN. Los
 * requisitos no obligatorios (isMandatory: false) no bloquean el semáforo
 * global — son orientativos.
 */
export function rollupEligibility(
  results: EligibilityResult[],
  requirements: EligibilityRequirement[]
): EligibilityRollup {
  const mandatoryIds = new Set(requirements.filter((r) => r.isMandatory).map((r) => r.id));
  const relevant = results.filter((r) => mandatoryIds.has(r.requirementId));
  const pool = relevant.length > 0 ? relevant : results;

  if (pool.length === 0) {
    return { status: "AMBER", score: 50 };
  }

  const hasRed = pool.some((r) => r.status === "RED");
  const hasAmber = pool.some((r) => r.status === "AMBER");
  const status: EligibilityRollup["status"] = hasRed ? "RED" : hasAmber ? "AMBER" : "GREEN";

  const points = pool.reduce((sum, r) => sum + (r.status === "GREEN" ? 1 : r.status === "AMBER" ? 0.5 : 0), 0);
  const score = Math.round((points / pool.length) * 100);

  return { status, score };
}
