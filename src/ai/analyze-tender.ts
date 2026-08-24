import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { TenderSourceType } from "@prisma/client";

import { getAnthropicClient, CLAUDE_MODEL } from "./client";
import { buildTenderSystemBlocks } from "./context";
import { calculateCostCents } from "./pricing";
import {
  TenderAnalysisExtractionSchema,
  type TenderAnalysisExtraction,
} from "./schemas/tender-analysis";
import {
  REQUIREMENTS_EXTRACTION_PROMPT_VERSION,
  buildRequirementsExtractionInstructions,
} from "./prompts/requirements-extraction";

export { REQUIREMENTS_EXTRACTION_PROMPT_VERSION };

export interface AnalyzeTenderUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costCents: number;
  durationMs: number;
}

export interface AnalyzeTenderResult {
  extraction: TenderAnalysisExtraction;
  usage: AnalyzeTenderUsage;
}

const MAX_ATTEMPTS = 3;
// Documento completo (hasta ~150 páginas) en el prefill: puede tardar más
// que una petición normal — timeout generoso, y streaming (recomendado
// para inputs largos) para evitar timeouts intermedios de HTTP.
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Paso (b) del pipeline: extracción de requisitos excluyentes + criterios
 * de baremo + resumen ejecutivo, en una sola llamada (comparten el mismo
 * prefill del documento). Valida la respuesta con Zod vía structured
 * outputs; si el modelo devuelve algo que no encaja en el schema, reintenta
 * hasta MAX_ATTEMPTS veces indicándole el error concreto.
 */
export async function analyzeTenderRequirements(
  tenderText: string,
  sourceType: TenderSourceType
): Promise<AnalyzeTenderResult> {
  const client = getAnthropicClient();
  const startedAt = Date.now();
  const systemBlocks = buildTenderSystemBlocks(tenderText);
  const taskInstructions = buildRequirementsExtractionInstructions(sourceType);

  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const userMessage =
      lastErrorMessage === null
        ? taskInstructions
        : `${taskInstructions}\n\nTu respuesta anterior no fue válida: ${lastErrorMessage}. Revisa especialmente los tipos de dato y los campos obligatorios.`;

    const stream = client.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system: systemBlocks,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: zodOutputFormat(TenderAnalysisExtractionSchema),
        },
        messages: [{ role: "user", content: userMessage }],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error(
        `Claude rechazó la solicitud de análisis (${message.stop_details?.category ?? "motivo no especificado"}).`
      );
    }

    if (message.parsed_output) {
      const usage = message.usage;
      const costCents = calculateCostCents({
        model: CLAUDE_MODEL,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      });

      return {
        extraction: message.parsed_output,
        usage: {
          model: CLAUDE_MODEL,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
          costCents,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    lastErrorMessage = "la respuesta no se pudo validar contra el schema esperado (JSON inválido o incompleto)";
  }

  throw new Error(
    `El modelo no devolvió una respuesta válida tras ${MAX_ATTEMPTS} intentos: ${lastErrorMessage}`
  );
}
