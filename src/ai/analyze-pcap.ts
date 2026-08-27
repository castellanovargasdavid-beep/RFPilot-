import type { TenderSourceType } from "@prisma/client";

import { buildTenderSystemBlocks } from "./context";
import { runStructuredExtraction, type StructuredCallUsage } from "./run-structured";
import { PcapExtractionSchema, type PcapExtraction } from "./schemas/pcap-extraction";
import { PCAP_EXTRACTION_PROMPT_VERSION, buildPcapExtractionInstructions } from "./prompts/pcap-extraction";

export { PCAP_EXTRACTION_PROMPT_VERSION };

export interface AnalyzePcapResult {
  extraction: PcapExtraction;
  usage: StructuredCallUsage;
}

/**
 * Paso (b1) del pipeline: requisitos de solvencia/habilitación/prohibición
 * de contratar + resumen ejecutivo, a partir del PCAP (o del documento
 * único, si no se subieron PCAP/PPT por separado).
 */
export async function analyzePcap(tenderText: string, sourceType: TenderSourceType): Promise<AnalyzePcapResult> {
  const systemBlocks = buildTenderSystemBlocks(tenderText);
  const taskInstructions = buildPcapExtractionInstructions(sourceType);

  const result = await runStructuredExtraction({
    systemBlocks,
    schema: PcapExtractionSchema,
    buildUserMessage: (retryContext) =>
      retryContext
        ? `${taskInstructions}\n\nTu respuesta anterior no fue válida: ${retryContext}. Revisa especialmente los tipos de dato y los campos obligatorios.`
        : taskInstructions,
  });

  return { extraction: result.data, usage: result.usage };
}
