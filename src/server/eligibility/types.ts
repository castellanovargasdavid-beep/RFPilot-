import type { EligibilityStatus, RequirementCategory } from "@prisma/client";

/** Vista descifrada/aplanada del perfil de empresa, tal como la necesita el motor de cruce. */
export interface EligibilityCompanyProfile {
  foundedYear: number | null;
  certifications: Array<{ name: string; expiresAt: Date | null }>;
  /** Importes ya descifrados. */
  revenueYears: Array<{ year: number; amount: number }>;
  references: Array<{
    title: string;
    sector: string | null;
    amount: number | null;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  teamMembers: Array<{ role: string; yearsExperience: number | null }>;
}

export interface EligibilityRequirement {
  id: string;
  category: RequirementCategory;
  description: string;
  citationText: string | null;
  isMandatory: boolean;
}

export interface EligibilityContext {
  /** Para comprobar que las certificaciones no caduquen antes de presentar la oferta. */
  submissionDeadline: Date | null;
}

export interface EligibilityResult {
  requirementId: string;
  status: EligibilityStatus;
  reasoning: string;
  matchedProfileFact: string | null;
}

export type RequirementMatcher = (
  requirement: EligibilityRequirement,
  profile: EligibilityCompanyProfile,
  context: EligibilityContext
) => EligibilityResult;
