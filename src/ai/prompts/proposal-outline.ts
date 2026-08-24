export const PROPOSAL_OUTLINE_PROMPT_VERSION = "proposal-outline@1";

export function buildProposalOutlineInstructions(): string {
  return `Genera el índice de la propuesta/memoria técnica que exige este pliego.

Básate primero en la estructura exigida explícitamente por el pliego (busca cláusulas sobre "contenido de la
oferta técnica", "memoria técnica", "documentación a presentar en el sobre técnico" o similares). Si el pliego
no detalla una estructura concreta, deriva el índice de los criterios de valoración/baremo — cada criterio
puntuable suele merecer su propio apartado, para que la propuesta esté organizada de forma que facilite
puntuar cada punto.

Reglas:
- Usa el idioma y la terminología del propio pliego (español).
- No incluyas apartados puramente administrativos (DEUC, declaraciones responsables, garantías, solvencia) —
  esta es la memoria TÉCNICA, no la documentación administrativa.
- Máximo 2 niveles de profundidad (secciones y, si hace falta, subsecciones).
- Para cada sección, la instrucción debe ser accionable: qué debe demostrar o incluir esa sección concreta
  para maximizar la puntuación en el criterio de valoración correspondiente, si aplica.
- Incluye siempre una sección inicial de resumen/presentación de la propuesta.`;
}
