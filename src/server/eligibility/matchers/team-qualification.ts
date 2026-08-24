import { extractYearsRequirement } from "../normalize";
import type { RequirementMatcher } from "../types";

export const matchTeamQualificationRequirement: RequirementMatcher = (requirement, profile) => {
  const yearsRequired = extractYearsRequirement(`${requirement.description} ${requirement.citationText ?? ""}`);

  if (yearsRequired === null || profile.teamMembers.length === 0) {
    return {
      requirementId: requirement.id,
      status: "AMBER",
      reasoning: "No se ha podido verificar automáticamente este requisito de cualificación del equipo. Revísalo manualmente.",
      matchedProfileFact: null,
    };
  }

  const qualifiedMember = profile.teamMembers.find((m) => (m.yearsExperience ?? 0) >= yearsRequired);

  if (qualifiedMember) {
    return {
      requirementId: requirement.id,
      status: "GREEN",
      reasoning: `El equipo incluye a "${qualifiedMember.role}" con ${qualifiedMember.yearsExperience} años de experiencia, cubriendo el mínimo de ${yearsRequired} exigido.`,
      matchedProfileFact: `${qualifiedMember.role}: ${qualifiedMember.yearsExperience} años`,
    };
  }

  return {
    requirementId: requirement.id,
    status: "AMBER",
    reasoning: `Ningún miembro del equipo registrado alcanza los ${yearsRequired} años de experiencia exigidos. Revísalo manualmente.`,
    matchedProfileFact: null,
  };
};
