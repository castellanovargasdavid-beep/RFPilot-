import { normalizeText } from "@/server/eligibility/normalize";
import type { StructuralBlock } from "./structural-extract";

/**
 * Guardrail determinista anti-alucinación: antes de dar por buena una
 * `cita_literal` que devuelve Claude, comprobamos que existe de verdad
 * (textual o casi-textualmente) en la página que el propio modelo dice
 * haber citado. Nunca confiamos en el `nivel_certeza` que el modelo se
 * autoasigna — este chequeo es independiente y puede degradar el
 * resultado aunque el modelo diga "ALTO".
 */
export interface CitationVerification {
  verified: boolean;
  similarity: number;
  matchedBlock: StructuralBlock | null;
}

const FUZZY_MATCH_THRESHOLD = 0.85;
/** Evita costear Levenshtein sobre párrafos absurdamente largos (tablas mal segmentadas, etc.). */
const MAX_COMPARABLE_LENGTH = 4000;

export function verifyCitation(
  citaLiteral: string,
  pagina: number,
  blocks: StructuralBlock[]
): CitationVerification {
  const needle = normalizeText(citaLiteral);
  if (!needle) return { verified: false, similarity: 0, matchedBlock: null };

  const pageBlocks = blocks.filter((b) => b.pagina === pagina);
  if (pageBlocks.length === 0) return { verified: false, similarity: 0, matchedBlock: null };

  let best: { similarity: number; block: StructuralBlock } | null = null;

  for (const block of pageBlocks) {
    const haystack = normalizeText(block.text).slice(0, MAX_COMPARABLE_LENGTH);
    if (haystack.includes(needle)) {
      return { verified: true, similarity: 1, matchedBlock: block };
    }
    const similarity = bestWindowSimilarity(needle, haystack);
    if (!best || similarity > best.similarity) {
      best = { similarity, block };
    }
  }

  // Una cita puede quedar partida entre dos párrafos consecutivos si el
  // extractor cortó donde no debía — se prueba también la unión de cada
  // par de bloques adyacentes en la misma página antes de rendirse.
  for (let i = 0; i < pageBlocks.length - 1; i++) {
    const merged = normalizeText(`${pageBlocks[i].text} ${pageBlocks[i + 1].text}`).slice(0, MAX_COMPARABLE_LENGTH);
    if (merged.includes(needle)) {
      return { verified: true, similarity: 1, matchedBlock: pageBlocks[i] };
    }
  }

  if (best && best.similarity >= FUZZY_MATCH_THRESHOLD) {
    return { verified: true, similarity: best.similarity, matchedBlock: best.block };
  }

  return { verified: false, similarity: best?.similarity ?? 0, matchedBlock: null };
}

/** Similitud (1 - distancia de Levenshtein normalizada) de `needle` contra la mejor ventana deslizante de `haystack`. */
function bestWindowSimilarity(needle: string, haystack: string): number {
  if (haystack.length === 0) return 0;
  if (haystack.length <= needle.length * 1.3) {
    return similarityRatio(needle, haystack);
  }

  const windowSize = needle.length;
  const step = Math.max(10, Math.floor(windowSize / 4));
  let best = 0;
  for (let start = 0; start <= haystack.length - windowSize; start += step) {
    const window = haystack.slice(start, start + windowSize);
    const ratio = similarityRatio(needle, window);
    if (ratio > best) best = ratio;
    if (best === 1) break;
  }
  return best;
}

function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/** Distancia de Levenshtein clásica, O(n*m) con una sola fila de trabajo. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(previousRow[j] + 1, currentRow[j - 1] + 1, previousRow[j - 1] + cost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}
