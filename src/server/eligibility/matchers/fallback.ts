import type { RequirementMatcher } from "../types";

/**
 * Categorías sin datos estructurados equivalentes en el perfil de empresa
 * (documentación administrativa, declaraciones responsables, pólizas de
 * seguro concretas...). Nunca se marcan como GREEN por defecto: el coste
 * de un falso "cumples" es mucho mayor que el de pedirle al usuario que
 * revise manualmente un punto — ver ARCHITECTURE.md § Cruce de requisitos.
 */
export const matchUnverifiableRequirement: RequirementMatcher = (requirement) => ({
  requirementId: requirement.id,
  status: "AMBER",
  reasoning:
    "Este tipo de requisito no se puede verificar automáticamente contra los datos estructurados del perfil de empresa. Revísalo manualmente antes de presentar la oferta.",
  matchedProfileFact: null,
});
