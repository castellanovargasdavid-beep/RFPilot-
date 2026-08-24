import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient, CLAUDE_MODEL } from "./client";
import { buildTenderSystemBlocks } from "./context";
import { calculateCostCents } from "./pricing";
import type { StructuredCallUsage } from "./run-structured";

export const SECTION_GENERATION_PROMPT_VERSION = "section-generation@1";

export interface SectionGenerationParams {
  tenderText: string;
  sectionTitle: string;
  sectionInstructions: string | null;
  /** Títulos de las secciones padre, de más general a más concreto — da contexto de dónde encaja esta sección. */
  breadcrumb: string[];
  /** Resumen en texto plano de certificaciones/experiencia/equipo — ver src/server/company-profile/summarize.ts. */
  companyProfileSummary: string;
}

export interface SectionGenerationResult {
  content: string;
  usage: StructuredCallUsage;
}

const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Paso (e) del pipeline: contenido de UNA sección, bajo demanda (nunca
 * todas de golpe — controla coste y permite "regenerar esta sección").
 * Salida en markdown libre, no structured output: aquí lo que queremos es
 * prosa persuasiva, no datos que validar contra un schema.
 */
export async function generateSectionContent(params: SectionGenerationParams): Promise<SectionGenerationResult> {
  const client = getAnthropicClient();
  const startedAt = Date.now();
  const systemBlocks = buildTenderSystemBlocks(params.tenderText);

  const sectionPath = [...params.breadcrumb, params.sectionTitle].join(" > ");
  const userMessage = `Redacta el contenido de la siguiente sección de la propuesta técnica, en español, en formato
markdown (usa negritas y listas si aportan claridad; no repitas el título como encabezado — ya se muestra aparte).

Sección: ${sectionPath}
${params.sectionInstructions ? `Qué debe incluir esta sección: ${params.sectionInstructions}` : ""}

Datos reales de la empresa que puedes usar — no inventes datos que no estén aquí, y si falta información
relevante dilo explícitamente en vez de rellenar con generalidades:
${params.companyProfileSummary || "(el perfil de empresa está vacío — redacta la sección señalando qué información falta por completar)"}

Escribe un contenido persuasivo, concreto y específico para este pliego — evita relleno genérico intercambiable
con cualquier otra propuesta. Longitud orientativa: 150-400 palabras, salvo que la sección exija claramente
más detalle.`;

  const stream = client.messages.stream(
    {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemBlocks,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: userMessage }],
    },
    { timeout: REQUEST_TIMEOUT_MS }
  );

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`Claude rechazó la solicitud (${message.stop_details?.category ?? "motivo no especificado"}).`);
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const content = textBlock?.text?.trim() ?? "";

  if (!content) {
    throw new Error("El modelo no devolvió contenido de texto para esta sección.");
  }

  const usage = message.usage;
  const costCents = calculateCostCents({
    model: CLAUDE_MODEL,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
  });

  return {
    content,
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
