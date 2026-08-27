// IMPORTANTE: zod/v4, no zod v3 — ver nota en tender-analysis.ts.
import { z } from "zod/v4";

import { ReferenciaSchema, NivelCertezaSchema } from "./pcap-extraction";

/**
 * El PPT (Pliego de Prescripciones Técnicas) rara vez impone requisitos
 * eliminatorios propios — normalmente describe el alcance técnico, SLAs y
 * el baremo de valoración. Cuando sí hay un requisito técnico eliminatorio
 * (p.ej. una certificación o medio técnico obligatorio descrito solo aquí),
 * se etiqueta SOLVENCIA_TECNICA, igual que en el PCAP — es el mismo tipo
 * legal, solo que la cita procede del pliego técnico en vez del
 * administrativo.
 */
export const PptTechnicalRequirementSchema = z.object({
  tipo: z.literal("SOLVENCIA_TECNICA"),
  descripcion: z.string().describe("Descripción clara y parafraseada del requisito técnico eliminatorio, en español."),
  es_excluyente: z.boolean(),
  cita_literal: z
    .string()
    .describe("Cita copiada TEXTUALMENTE del PPT, sin parafrasear, máx. ~300 caracteres. Se verifica automáticamente contra el documento."),
  referencia: ReferenciaSchema,
  nivel_certeza: NivelCertezaSchema,
});

export const PptCriterionSchema = z.object({
  tipo: z.literal("CRITERIO_ADJUDICACION"),
  nombre: z.string().describe("Nombre del criterio de valoración/baremo, p.ej. 'Oferta económica', 'Mejoras técnicas', 'SLA de resolución de incidencias'."),
  descripcion: z.string().nullable().describe("Detalle de cómo se puntúa este criterio, si el pliego lo especifica (fórmulas, tramos, SLAs exigidos)."),
  weightPercent: z.number().min(0).max(100).describe("Peso del criterio en % sobre el total del baremo."),
  maxPoints: z.number().nullable().describe("Puntuación máxima si el pliego usa una escala de puntos en vez de/además de %."),
  cita_literal: z.string().nullable().describe("Cita textual del pliego que sustenta el peso/fórmula de este criterio, si aplica. null si es un resumen sin cita concreta."),
  referencia: ReferenciaSchema.nullable(),
  nivel_certeza: NivelCertezaSchema,
});

export const PptExtractionSchema = z.object({
  criteriosAdjudicacion: z
    .array(PptCriterionSchema)
    .describe("Criterios de baremo/adjudicación con sus pesos, tal como los defina el PPT. Array vacío si no hay baremo detallado en este documento."),
  requisitosTecnicos: z
    .array(PptTechnicalRequirementSchema)
    .describe("Requisitos técnicos ELIMINATORIOS descritos específicamente en el PPT (no en el PCAP). Array vacío en el caso normal — la mayoría de solvencia técnica va en el PCAP."),
});

export type PptTechnicalRequirement = z.infer<typeof PptTechnicalRequirementSchema>;
export type PptCriterion = z.infer<typeof PptCriterionSchema>;
export type PptExtraction = z.infer<typeof PptExtractionSchema>;
