import { extractMoneyThreshold } from "../money";
import type { RequirementMatcher } from "../types";

function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export const matchFinancialRequirement: RequirementMatcher = (requirement, profile) => {
  const threshold = extractMoneyThreshold(`${requirement.description} ${requirement.citationText ?? ""}`);

  if (threshold === null) {
    return {
      requirementId: requirement.id,
      status: "AMBER",
      reasoning:
        "No se ha podido determinar automáticamente el importe económico exigido por este requisito. Revísalo manualmente.",
      matchedProfileFact: null,
    };
  }

  if (profile.revenueYears.length === 0) {
    return {
      requirementId: requirement.id,
      status: "AMBER",
      reasoning: `El requisito exige un importe de referencia de ${formatEur(threshold)}, pero el perfil de empresa no tiene datos de facturación registrados.`,
      matchedProfileFact: null,
    };
  }

  const avg = profile.revenueYears.reduce((sum, y) => sum + y.amount, 0) / profile.revenueYears.length;
  const fact = `Facturación media (${profile.revenueYears.length} ejercicios): ${formatEur(avg)}`;

  if (avg >= threshold) {
    return {
      requirementId: requirement.id,
      status: "GREEN",
      reasoning: `La facturación media de los últimos ${profile.revenueYears.length} ejercicios (${formatEur(avg)}) supera el importe exigido (${formatEur(threshold)}).`,
      matchedProfileFact: fact,
    };
  }

  return {
    requirementId: requirement.id,
    status: "RED",
    reasoning: `La facturación media de los últimos ${profile.revenueYears.length} ejercicios (${formatEur(avg)}) no alcanza el importe exigido (${formatEur(threshold)}).`,
    matchedProfileFact: fact,
  };
};
