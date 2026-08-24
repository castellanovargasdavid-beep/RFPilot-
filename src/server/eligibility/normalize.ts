/** Minúsculas, sin acentos, espacios colapsados — para comparar texto libre de forma tolerante. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** true si `needle` normalizado aparece dentro de `haystack` normalizado. */
export function containsNormalized(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}

/** Extrae códigos tipo "ISO 9001", "ISO/IEC 27001", "UNE 166002" del texto. Devuelve la parte numérica normalizada. */
export function extractStandardCodes(text: string): string[] {
  const normalized = normalizeText(text);
  const matches = normalized.matchAll(/\b(iso(?:\/iec)?|une(?:-en)?|ens)\s*[- ]?\s*(\d{3,6})\b/g);
  const codes: string[] = [];
  for (const m of matches) {
    codes.push(`${m[1].replace(/\//g, "")}${m[2]}`);
  }
  // "Esquema Nacional de Seguridad" se cita a menudo sin la sigla "ENS" seguida de número.
  if (/esquema nacional de seguridad/.test(normalized)) {
    codes.push("ens");
  }
  return codes;
}

/** Busca un número de años (p.ej. "al menos 3 años de experiencia") y devuelve el mayor encontrado. */
export function extractYearsRequirement(text: string): number | null {
  const normalized = normalizeText(text);
  const matches = [...normalized.matchAll(/(\d+)\s*(?:o mas\s*)?anos?/g)];
  if (matches.length === 0) return null;
  return Math.max(...matches.map((m) => Number(m[1])));
}

/** Busca un número de referencias/contratos similares exigidos (p.ej. "al menos 2 contratos similares"). */
export function extractReferenceCountRequirement(text: string): number | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/(\d+)\s*(?:contratos?|referencias?|proyectos?)\s*(?:similares?)?/);
  return match ? Number(match[1]) : null;
}
