import Anthropic from "@anthropic-ai/sdk";

/**
 * Modelo único para todo el pipeline de IA. Se usa Opus por defecto porque
 * la extracción de requisitos excluyentes es la lógica más crítica del
 * producto (un falso negativo/positivo le cuesta la licitación al
 * cliente) — no se degrada a un modelo más barato sin que el usuario lo
 * pida explícitamente.
 */
export const CLAUDE_MODEL = "claude-opus-5";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY no está configurada. El pipeline de análisis IA no puede ejecutarse sin ella."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
