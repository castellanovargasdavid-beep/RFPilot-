import { buildTenderSystemBlocks } from "./context";
import { runStructuredExtraction, type StructuredCallUsage } from "./run-structured";
import { PptExtractionSchema, type PptExtraction } from "./schemas/ppt-extraction";
import { PPT_EXTRACTION_PROMPT_VERSION, buildPptExtractionInstructions } from "./prompts/ppt-extraction";

export { PPT_EXTRACTION_PROMPT_VERSION };

export interface AnalyzePptResult {
  extraction: PptExtraction;
  usage: StructuredCallUsage;
}

/**
 * Paso (b2) del pipeline: criterios de adjudicación/baremo + requisitos
 * técnicos eliminatorios, a partir del PPT (o del mismo documento único
 * que el PCAP si no se subieron por separado — en ese caso esta llamada
 * comparte el prefijo cacheado de la anterior, ver ARCHITECTURE.md).
 */
export async function analyzePpt(tenderText: string): Promise<AnalyzePptResult> {
  const systemBlocks = buildTenderSystemBlocks(tenderText);
  const taskInstructions = buildPptExtractionInstructions();

  const result = await runStructuredExtraction({
    systemBlocks,
    schema: PptExtractionSchema,
    buildUserMessage: (retryContext) =>
      retryContext
        ? `${taskInstructions}\n\nTu respuesta anterior no fue válida: ${retryContext}. Revisa especialmente los tipos de dato y los campos obligatorios.`
        : taskInstructions,
  });

  return { extraction: result.data, usage: result.usage };
}
