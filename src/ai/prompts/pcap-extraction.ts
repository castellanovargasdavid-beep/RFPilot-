import type { TenderSourceType } from "@prisma/client";

/**
 * Prompt especializado en el PCAP (Pliego de Cláusulas Administrativas
 * Particulares): solvencia económica/técnica, habilitación empresarial,
 * prohibiciones de contratar, y el resumen ejecutivo (plazos, presupuesto,
 * alcance) — todo lo que es jurídico/administrativo, no técnico. Separado
 * del prompt del PPT (ver ppt-extraction.ts) porque son dos disciplinas
 * legales distintas y mezclar sus criterios en un único prompt genérico es
 * precisamente el tipo de vaguedad que produce alucinaciones — ver
 * ARCHITECTURE.md § RAG estructural.
 */
export const PCAP_EXTRACTION_PROMPT_VERSION = "pcap-extraction@1";

export function buildPcapExtractionInstructions(sourceType: TenderSourceType): string {
  const contextLine =
    sourceType === "PUBLIC_TENDER"
      ? "Es una licitación pública (probablemente sujeta a la Ley de Contratos del Sector Público española u homóloga)."
      : "Es un RFP (Request for Proposal) corporativo de un cliente privado.";

  return `${contextLine} Actúa como un especialista en cláusulas administrativas y económicas de contratación (PCAP), no en
requisitos técnicos — esos los analiza otro proceso especializado por separado.

El texto del documento incluye marcadores "[PÁGINA n]" antes del contenido de cada página. Úsalos para rellenar
\`referencia.pagina\` con la página REAL donde aparece cada cita — nunca la adivines ni la dejes en 1 por defecto.

Extrae, con la mayor exhaustividad posible, SOLO lo administrativo/jurídico/económico:

1. **Requisitos de solvencia y habilitación** — para cada uno, clasifícalo con \`tipo\`:
   - SOLVENCIA_ECONOMICA: facturación mínima, ratios financieros, patrimonio neto, seguro de responsabilidad civil con importe mínimo.
   - SOLVENCIA_TECNICA: experiencia previa en contratos similares, medios técnicos/humanos exigidos, clasificación empresarial.
   - HABILITACION_EMPRESARIAL: forma jurídica, objeto social, registro/inscripción exigida, capacidad de obrar.
   - PROHIBICION_CONTRATAR: causas de prohibición de contratar (art. 71 LCSP y análogos), estar al corriente de pago con
     Hacienda/Seguridad Social, incompatibilidades.

   Para cada requisito: \`cita_literal\` debe ser una copia EXACTA del texto del pliego (no la parafrasees, no la
   "limpies", no corrijas erratas) — se verificará automáticamente contra el documento real, y si no coincide el
   requisito quedará marcado para revisión humana en vez de mostrarse como fiable. La \`descripcion\` sí puede (y debe)
   ser un parafraseo claro en español. No inventes ni "generalices" requisitos que no estén explícitamente en el
   texto — es preferible omitir uno dudoso que inventar uno que no existe. Asigna \`nivel_certeza\` con honestidad: si
   dudas, AMBIGUO o DUDOSO, nunca ALTO por defecto.

2. **Resumen ejecutivo**: alcance del contrato, fecha límite de presentación, fecha límite de aclaraciones,
   presupuesto máximo/base de licitación, duración del contrato, y organismo/empresa contratante.

Si el documento no tiene una sección de requisitos de solvencia/admisión identificable con claridad, marca
\`requirementsSectionUnclear: true\` y haz una estimación de mejor esfuerzo igualmente a partir de menciones
dispersas en el texto — nunca dejes el array vacío solo por pereza de buscar.

No extraigas criterios de valoración/baremo ni requisitos puramente técnicos aquí — eso lo cubre el análisis del PPT.`;
}
