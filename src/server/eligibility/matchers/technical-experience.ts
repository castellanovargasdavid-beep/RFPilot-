import { extractReferenceCountRequirement, extractYearsRequirement } from "../normalize";
import type { RequirementMatcher } from "../types";

export const matchTechnicalExperienceRequirement: RequirementMatcher = (requirement, profile) => {
  const requirementText = `${requirement.description} ${requirement.citationText ?? ""}`;
  const refsRequired = extractReferenceCountRequirement(requirementText);

  if (refsRequired !== null) {
    if (profile.references.length >= refsRequired) {
      return {
        requirementId: requirement.id,
        status: "GREEN",
        reasoning: `El perfil incluye ${profile.references.length} referencias/proyectos previos, cubriendo el mínimo de ${refsRequired} exigido.`,
        matchedProfileFact: `${profile.references.length} referencias registradas`,
      };
    }
    return {
      requirementId: requirement.id,
      status: "RED",
      reasoning: `El perfil solo tiene ${profile.references.length} referencias registradas, por debajo del mínimo de ${refsRequired} exigido.`,
      matchedProfileFact: `${profile.references.length} referencias registradas`,
    };
  }

  const yearsRequired = extractYearsRequirement(requirementText);
  if (yearsRequired !== null) {
    const companyAge = profile.foundedYear ? new Date().getFullYear() - profile.foundedYear : 0;
    const maxTeamExperience = profile.teamMembers.reduce((max, m) => Math.max(max, m.yearsExperience ?? 0), 0);
    const bestSignal = Math.max(companyAge, maxTeamExperience);

    if (bestSignal >= yearsRequired) {
      return {
        requirementId: requirement.id,
        status: "GREEN",
        reasoning: `La experiencia disponible (${bestSignal} años, entre antigüedad de empresa y equipo) cubre el mínimo de ${yearsRequired} años exigido.`,
        matchedProfileFact: `${bestSignal} años de experiencia disponible`,
      };
    }
    return {
      requirementId: requirement.id,
      status: "AMBER",
      reasoning: `La experiencia detectada en el perfil (${bestSignal} años) no alcanza claramente el mínimo de ${yearsRequired} años exigido — revisa si hay referencias o miembros de equipo adicionales sin registrar.`,
      matchedProfileFact: `${bestSignal} años de experiencia disponible`,
    };
  }

  return {
    requirementId: requirement.id,
    status: "AMBER",
    reasoning:
      "No se ha podido determinar automáticamente si el perfil cumple este requisito de experiencia/solvencia técnica. Revísalo manualmente.",
    matchedProfileFact: null,
  };
};
