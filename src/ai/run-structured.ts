import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";

import { getAnthropicClient, CLAUDE_MODEL } from "./client";
import { calculateCostCents } from "./pricing";

export interface StructuredCallUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costCents: number;
  durationMs: number;
}

export interface StructuredCallResult<T> {
  data: T;
  usage: StructuredCallUsage;
}

const DEFAULT_MAX_ATTEMPTS = 3;
// El pliego completo (hasta ~150 páginas) va en el prefill: puede tardar
// más que una petición normal — streaming + timeout generoso.
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Llamada a Claude con salida estructurada (Zod) + reintento automático si
 * la respuesta no valida contra el schema — helper compartido por todos
 * los pasos del pipeline que necesitan JSON tipado (nunca texto libre
 * parseado con regex).
 */
export async function runStructuredExtraction<T>(params: {
  systemBlocks: Anthropic.TextBlockParam[];
  schema: z.ZodType<T>;
  buildUserMessage: (retryContext: string | null) => string;
  maxAttempts?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}): Promise<StructuredCallResult<T>> {
  const client = getAnthropicClient();
  const startedAt = Date.now();
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const stream = client.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens ?? 16000,
        system: params.systemBlocks,
        thinking: { type: "adaptive" },
        output_config: {
          effort: params.effort ?? "high",
          format: zodOutputFormat(params.schema),
        },
        messages: [{ role: "user", content: params.buildUserMessage(lastErrorMessage) }],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error(
        `Claude rechazó la solicitud (${message.stop_details?.category ?? "motivo no especificado"}).`
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
        data: message.parsed_output,
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

  throw new Error(`El modelo no devolvió una respuesta válida tras ${maxAttempts} intentos: ${lastErrorMessage}`);
}
