import type Anthropic from "@anthropic-ai/sdk";

/**
 * Bloque de sistema compartido por TODOS los pasos del pipeline que
 * necesitan el pliego completo (extracción de requisitos, generación del
 * índice de propuesta, generación de contenido por sección — Fases 3 y 5).
 * Mantener el prefijo byte-a-byte idéntico entre pasos es lo que permite
 * que el prompt caching de Anthropic reutilice el prefill del documento en
 * vez de reprocesar un pliego de 150 páginas en cada llamada — ver
 * ARCHITECTURE.md § Pipeline de IA.
 */
const PERSONA_PREAMBLE =
  "Eres un consultor senior especializado en licitaciones públicas españolas (LCSP) y en RFPs corporativos, " +
  "con experiencia evaluando si una empresa debería presentarse a un concurso y redactando ofertas técnicas ganadoras. " +
  "Trabajas con precisión legal: nunca inventas datos que no estén en el documento, y cuando algo es ambiguo lo señalas " +
  "en vez de asumir la interpretación más favorable.";

export function buildTenderSystemBlocks(tenderText: string): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: PERSONA_PREAMBLE },
    {
      type: "text",
      text: `A continuación se incluye el texto completo del pliego/RFP a analizar, extraído de un PDF (puede incluir artefactos menores de formato):\n\n<documento>\n${tenderText}\n</documento>`,
      cache_control: { type: "ephemeral" },
    },
  ];
}
