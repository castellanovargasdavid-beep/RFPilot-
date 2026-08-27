// IMPORTANTE: zod/v4, no zod v3 — ver nota en tender-analysis.ts.
import { z } from "zod/v4";

import { ExecutiveSummarySchema } from "./tender-analysis";

export const PliegoDocumentSchema = z.enum(["PCAP", "PPT"]);
export const NivelCertezaSchema = z.enum(["ALTO", "DUDOSO", "AMBIGUO"]);

export const ReferenciaSchema = z.object({
  pliego: PliegoDocumentSchema.describe(
    "A qué pliego pertenece esta cita: PCAP (cláusulas administrativas/jurídicas/económicas) o PPT (prescripciones técnicas)."
  ),
  clausula: z
    .string()
    .describe("Número de cláusula/artículo/apartado tal como lo numera el pliego, p.ej. '7.2' o 'Anexo III'. Cadena vacía si no se puede determinar con confianza."),
  pagina: z.number().int().describe("Página donde aparece la cita literal — debe coincidir con el marcador [PÁGINA n] bajo el que aparece el texto citado."),
});

export const PcapRequirementTypeSchema = z.enum([
  "SOLVENCIA_ECONOMICA",
  "SOLVENCIA_TECNICA",
  "HABILITACION_EMPRESARIAL",
  "PROHIBICION_CONTRATAR",
]);

export const PcapRequirementSchema = z.object({
  tipo: PcapRequirementTypeSchema.describe(
    "SOLVENCIA_ECONOMICA (facturación, ratios financieros), SOLVENCIA_TECNICA (experiencia previa, medios técnicos/humanos, clasificación empresarial), " +
      "HABILITACION_EMPRESARIAL (forma jurídica, registro, habilitación para contratar con el sector público), " +
      "PROHIBICION_CONTRATAR (causas de prohibición de contratar, incompatibilidades, no estar al corriente de pago con Hacienda/SS)."
  ),
  descripcion: z
    .string()
    .describe("Descripción clara y parafraseada del requisito, en español — NO tiene que coincidir textualmente con el pliego (para eso está cita_literal)."),
  es_excluyente: z
    .boolean()
    .describe("true si incumplirlo descalifica al licitador (eliminatorio); false si es orientativo/deseable/valorable."),
  cita_literal: z
    .string()
    .describe(
      "Cita copiada TEXTUALMENTE del pliego (carácter a carácter, sin parafrasear ni corregir), máx. ~300 caracteres. " +
        "Se verificará automáticamente contra el texto real del documento — si inventas o alteras la cita, el requisito quedará marcado para revisión humana."
    ),
  referencia: ReferenciaSchema,
  nivel_certeza: NivelCertezaSchema.describe(
    "Tu propia confianza: ALTO si el requisito y la cita son inequívocos, DUDOSO si hay ambigüedad menor en la redacción, " +
      "AMBIGUO si es una inferencia débil a partir de menciones dispersas. Ante la duda, nunca marques ALTO."
  ),
});

export const PcapExtractionSchema = z.object({
  requisitos: z
    .array(PcapRequirementSchema)
    .describe(
      "Todos los requisitos de solvencia económica/técnica, habilitación empresarial y prohibiciones de contratar. " +
        "Array vacío si genuinamente no hay ninguno — nunca inventes uno que no esté en el texto."
    ),
  executiveSummary: ExecutiveSummarySchema,
  requirementsSectionUnclear: z
    .boolean()
    .describe(
      "true SOLO si el documento no tiene una sección de requisitos de solvencia/admisión clara y los datos extraídos " +
        "son una estimación de mejor esfuerzo; false en el caso normal."
    ),
});

export type PliegoDocument = z.infer<typeof PliegoDocumentSchema>;
export type NivelCerteza = z.infer<typeof NivelCertezaSchema>;
export type Referencia = z.infer<typeof ReferenciaSchema>;
export type PcapRequirementType = z.infer<typeof PcapRequirementTypeSchema>;
export type PcapRequirement = z.infer<typeof PcapRequirementSchema>;
export type PcapExtraction = z.infer<typeof PcapExtractionSchema>;
