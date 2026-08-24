import { extractStandardCodes, containsNormalized } from "../normalize";
import type { RequirementMatcher } from "../types";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const matchCertificationRequirement: RequirementMatcher = (requirement, profile, context) => {
  const requirementText = `${requirement.description} ${requirement.citationText ?? ""}`;
  const requiredCodes = extractStandardCodes(requirementText);

  let matched = requiredCodes.length
    ? profile.certifications.find((cert) => extractStandardCodes(cert.name).some((code) => requiredCodes.includes(code)))
    : undefined;

  if (!matched) {
    matched = profile.certifications.find(
      (cert) => containsNormalized(requirementText, cert.name) || containsNormalized(cert.name, requirement.description)
    );
  }

  if (!matched) {
    return {
      requirementId: requirement.id,
      status: "RED",
      reasoning: "No se ha encontrado ninguna certificación en el perfil de empresa que coincida con este requisito.",
      matchedProfileFact: null,
    };
  }

  if (matched.expiresAt) {
    const deadline = context.submissionDeadline ?? new Date();
    if (matched.expiresAt < deadline) {
      const reasoning = context.submissionDeadline
        ? `La certificación "${matched.name}" del perfil caduca el ${formatDate(matched.expiresAt)}, antes de la fecha límite de presentación (${formatDate(context.submissionDeadline)}). Renuévala antes de presentar la oferta.`
        : `La certificación "${matched.name}" del perfil ya ha caducado (${formatDate(matched.expiresAt)}). Renuévala antes de presentar la oferta.`;
      return {
        requirementId: requirement.id,
        status: "AMBER",
        reasoning,
        matchedProfileFact: matched.name,
      };
    }
  }

  return {
    requirementId: requirement.id,
    status: "GREEN",
    reasoning: `El perfil de empresa incluye la certificación "${matched.name}"${
      matched.expiresAt ? `, vigente hasta ${formatDate(matched.expiresAt)}` : ""
    }.`,
    matchedProfileFact: matched.name,
  };
};
