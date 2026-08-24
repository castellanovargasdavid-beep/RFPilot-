import { buildTenderSystemBlocks } from "./context";
import { runStructuredExtraction, type StructuredCallUsage } from "./run-structured";
import { ProposalOutlineSchema, type ProposalOutlineExtraction } from "./schemas/proposal-outline";
import { PROPOSAL_OUTLINE_PROMPT_VERSION, buildProposalOutlineInstructions } from "./prompts/proposal-outline";

export { PROPOSAL_OUTLINE_PROMPT_VERSION };

export interface GenerateOutlineResult {
  outline: ProposalOutlineExtraction;
  usage: StructuredCallUsage;
}

/** Paso (d) del pipeline: índice de la propuesta técnica, reutilizando el prefill cacheado del pliego. */
export async function generateProposalOutline(tenderText: string): Promise<GenerateOutlineResult> {
  const systemBlocks = buildTenderSystemBlocks(tenderText);
  const instructions = buildProposalOutlineInstructions();

  const result = await runStructuredExtraction({
    systemBlocks,
    schema: ProposalOutlineSchema,
    buildUserMessage: (retryContext) =>
      retryContext
        ? `${instructions}\n\nTu respuesta anterior no fue válida: ${retryContext}.`
        : instructions,
  });

  return { outline: result.data, usage: result.usage };
}
