/**
 * Extrae un importe en euros de una frase en español, p.ej. de la
 * descripción de un requisito de solvencia económica. No es un parser de
 * lenguaje natural genérico — cubre los formatos habituales en pliegos
 * españoles (separador de miles con punto, decimales con coma,
 * "millones"/"mil" como multiplicador) y devuelve `null` cuando no
 * reconoce el formato, en vez de arriesgarse a inventar una cifra.
 */
const MONEY_PATTERN =
  /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\s*(millones?|mill\.|mil)?\s*(?:de\s*)?(€|eur\b|euros?)/gi;

const MULTIPLIERS: Record<string, number> = {
  millon: 1_000_000,
  millones: 1_000_000,
  "mill.": 1_000_000,
  mil: 1_000,
};

function parseSpanishNumber(raw: string): number {
  // "500.000" -> miles; "1,5" -> decimal; "500.000,50" -> miles + decimal
  if (raw.includes(".") && raw.includes(",")) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }
  if (raw.includes(",")) {
    return Number(raw.replace(",", "."));
  }
  return Number(raw.replace(/\./g, ""));
}

export function extractMoneyThreshold(text: string): number | null {
  const matches = [...text.matchAll(MONEY_PATTERN)];
  if (matches.length === 0) return null;

  const amounts = matches.map((m) => {
    const base = parseSpanishNumber(m[1]);
    const multiplierKey = m[2]?.toLowerCase().trim();
    const multiplier = multiplierKey ? (MULTIPLIERS[multiplierKey] ?? 1) : 1;
    return base * multiplier;
  });

  return Math.max(...amounts);
}
