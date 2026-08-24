import type { TenderSourceType } from "@prisma/client";

import { buildTenderSystemBlocks } from "./context";
import { runStructuredExtraction, type StructuredCallUsage } from "./run-structured";
import { TenderAnalysisExtractionSchema, type TenderAnalysisExtraction } from "./schemas/tender-analysis";
import {
  REQUIREMENTS_EXTRACTION_PROMPT_VERSION,
  buildRequirementsExtractionInstructions,
} from "./prompts/requirements-extraction";

export { REQUIREMENTS_EXTRACTION_PROMPT_VERSION };

export type AnalyzeTenderUsage = StructuredCallUsage;

export interface AnalyzeTenderResult {
  extraction: TenderAnalysisExtraction;
  usage: AnalyzeTenderUsage;
}

/**
 * Paso (b) del pipeline: extracción de requisitos excluyentes + criterios
 * de baremo + resumen ejecutivo, en una sola llamada (comparten el mismo
 * prefill del documento).
 */
export async function analyzeTenderRequirements(
  tenderText: string,
  sourceType: TenderSourceType
): Promise<AnalyzeTenderResult> {
  const systemBlocks = buildTenderSystemBlocks(tenderText);
  const taskInstructions = buildRequirementsExtractionInstructions(sourceType);

  const result = await runStructuredExtraction({
    systemBlocks,
    schema: TenderAnalysisExtractionSchema,
    buildUserMessage: (retryContext) =>
      retryContext
        ? `${taskInstructions}\n\nTu respuesta anterior no fue válida: ${retryContext}. Revisa especialmente los tipos de dato y los campos obligatorios.`
        : taskInstructions,
  });

  return { extraction: result.data, usage: result.usage };
}
