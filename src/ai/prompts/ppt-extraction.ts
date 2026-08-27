/**
 * Prompt especializado en el PPT (Pliego de Prescripciones Técnicas):
 * alcance técnico, SLAs y criterios de ponderación/baremo — no solvencia
 * económica ni habilitación empresarial, eso lo cubre el prompt del PCAP
 * (ver pcap-extraction.ts). Separar los dos prompts evita que el modelo
 * mezcle registros legales distintos en una sola pasada genérica.
 */
export const PPT_EXTRACTION_PROMPT_VERSION = "ppt-extraction@1";

export function buildPptExtractionInstructions(): string {
  return `Actúa como un especialista en prescripciones técnicas y criterios de adjudicación de contratación pública/RFP —
no en cláusulas administrativas ni de solvencia económica, eso lo analiza otro proceso especializado por separado.

El texto del documento incluye marcadores "[PÁGINA n]" antes del contenido de cada página. Úsalos para rellenar
\`referencia.pagina\` con la página REAL donde aparece cada cita — nunca la adivines ni la dejes en 1 por defecto.

Extrae, con la mayor exhaustividad posible:

1. **Criterios de adjudicación/baremo**: cada criterio de valoración de las ofertas con su peso porcentual o
   puntuación máxima, tal como los defina el documento (a menudo en un anexo o cláusula de "criterios de
   adjudicación"). Incluye SLAs concretos si forman parte de la puntuación (p.ej. "tiempo de resolución de
   incidencias < 4h: X puntos"). Si el documento no detalla baremo (p.ej. adjudicación por precio único sin
   desglose técnico), devuelve un array vacío — no inventes criterios que no existen.

2. **Requisitos técnicos ELIMINATORIOS** (\`tipo: "SOLVENCIA_TECNICA"\`) — SOLO si el PPT impone una condición técnica
   descalificatoria propia que no sea simplemente "se valorará" (eso es un criterio de adjudicación, no un
   requisito eliminatorio). Esto es infrecuente: la mayoría de la solvencia técnica se exige en el PCAP. Si tienes
   dudas sobre si algo es eliminatorio o solo valorable, trátalo como criterio de adjudicación, no como requisito.

Para toda cita: \`cita_literal\` debe ser una copia EXACTA del texto del documento (no la parafrasees, no la
"limpies") — se verificará automáticamente, y si no coincide quedará marcado para revisión humana. Asigna
\`nivel_certeza\` con honestidad: si dudas, AMBIGUO o DUDOSO, nunca ALTO por defecto.`;
}
