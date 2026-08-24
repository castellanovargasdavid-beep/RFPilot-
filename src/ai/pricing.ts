/**
 * Precios de la API de Claude (Anthropic), primer trimestre 2026. Se usan
 * para el tracking de coste por análisis (AiUsageLog) — controla márgenes
 * por plan, no es facturación exacta de Anthropic (que puede variar por
 * acuerdos concretos). Mantener sincronizado con la tabla de precios
 * vigente si se cambia de modelo.
 */
export const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-5": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
};

const DEFAULT_MODEL_PRICING = MODEL_PRICING["claude-opus-5"];

// Multiplicadores estándar de prompt caching de Anthropic sobre el precio
// de input: escritura en caché ~1.25x, lectura de caché ~0.1x.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export interface ClaudeUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

/** Devuelve el coste estimado en céntimos (para guardar en AiUsageLog.costCents). */
export function calculateCostCents(usage: ClaudeUsage): number {
  const pricing = MODEL_PRICING[usage.model] ?? DEFAULT_MODEL_PRICING;

  const regularInputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const cacheWriteCost =
    ((usage.cacheCreationInputTokens ?? 0) / 1_000_000) * pricing.inputPerMTok * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost =
    ((usage.cacheReadInputTokens ?? 0) / 1_000_000) * pricing.inputPerMTok * CACHE_READ_MULTIPLIER;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;

  const totalDollars = regularInputCost + cacheWriteCost + cacheReadCost + outputCost;
  return Math.round(totalDollars * 100);
}
