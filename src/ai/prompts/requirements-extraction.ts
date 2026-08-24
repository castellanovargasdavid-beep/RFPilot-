import type { TenderSourceType } from "@prisma/client";

/**
 * Versión del prompt — se guarda en TenderAnalysis.promptVersion. Súbela
 * cada vez que cambies el texto de forma que afecte al resultado, para
 * poder correlacionar análisis antiguos con la versión de prompt que los
 * generó (útil al depurar regresiones de calidad).
 */
export const REQUIREMENTS_EXTRACTION_PROMPT_VERSION = "requirements-extraction@1";

export function buildRequirementsExtractionInstructions(sourceType: TenderSourceType): string {
  const contextLine =
    sourceType === "PUBLIC_TENDER"
      ? "Es una licitación pública (probablemente sujeta a la Ley de Contratos del Sector Público española u homóloga)."
      : "Es un RFP (Request for Proposal) corporativo de un cliente privado.";

  return `${contextLine}

Analiza el documento completo y extrae, con la mayor exhaustividad posible:

1. **Requisitos excluyentes/eliminatorios** (solvencia económica y financiera, solvencia técnica/profesional,
   certificaciones exigidas, clasificación empresarial, seguros obligatorios, forma jurídica, y cualquier otra
   condición cuyo incumplimiento excluya a un licitador). Para cada uno: cita el texto EXACTO del pliego que lo
   establece (no lo parafrasees en la cita), y localiza página y/o cláusula si es posible. No inventes ni
   "generalices" requisitos que no estén explícitamente en el texto — es preferible omitir uno dudoso que
   inventar uno que no existe.
2. **Criterios de valoración/baremo** con sus pesos porcentuales o puntos máximos, tal como los defina el pliego
   (a menudo en un anexo o cláusula específica de "criterios de adjudicación").
3. **Resumen ejecutivo**: alcance del contrato, fecha límite de presentación, fecha límite de aclaraciones,
   presupuesto máximo/base de licitación, duración del contrato, y organismo/empresa contratante.

Si el documento no tiene una sección de requisitos de solvencia/admisión identificable con claridad, marca
\`requirementsSectionUnclear: true\` y haz una estimación de mejor esfuerzo igualmente a partir de menciones
dispersas en el texto — nunca dejes el array vacío solo por pereza de buscar.`;
}
