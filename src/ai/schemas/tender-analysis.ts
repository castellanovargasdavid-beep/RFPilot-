// IMPORTANTE: estos schemas se pasan a `zodOutputFormat()` del SDK de
// Anthropic, que espera instancias de zod v4 (import "zod/v4"), no v3. El
// resto de la app usa zod v3 normal ("zod") — zod 3.25+ empaqueta ambas
// APIs, así que no hace falta un paquete adicional, solo importar del
// subpath correcto en los archivos que construyen schemas para Claude.
import { z } from "zod/v4";

export const RequirementCategorySchema = z.enum([
  "CERTIFICATION",
  "FINANCIAL",
  "TECHNICAL_EXPERIENCE",
  "LEGAL_ADMINISTRATIVE",
  "TEAM_QUALIFICATION",
  "INSURANCE",
  "OTHER",
]);

export const ExclusionRequirementSchema = z.object({
  category: RequirementCategorySchema.describe(
    "Tipo de requisito: CERTIFICATION (ISO, certificaciones), FINANCIAL (solvencia económica, facturación mínima), " +
      "TECHNICAL_EXPERIENCE (solvencia técnica, experiencia previa, clasificación empresarial), " +
      "LEGAL_ADMINISTRATIVE (documentación, forma jurídica, no estar en prohibiciones de contratar), " +
      "TEAM_QUALIFICATION (titulaciones/experiencia del equipo), INSURANCE (seguros de responsabilidad civil), OTHER."
  ),
  description: z
    .string()
    .describe("Descripción clara y concisa del requisito, en español, parafraseada — no copies el texto legal completo."),
  citationText: z
    .string()
    .describe("Cita textual LITERAL (copiada, no parafraseada) del pliego que sustenta este requisito, máx. ~300 caracteres."),
  citationPage: z
    .number()
    .int()
    .nullable()
    .describe("Número de página del documento donde aparece esta cita, si se puede determinar con confianza; si no, null."),
  citationClause: z
    .string()
    .nullable()
    .describe("Número de cláusula/artículo/apartado si el pliego los numera (p.ej. 'Cláusula 6.2', 'Anexo III'); si no, null."),
  isMandatory: z
    .boolean()
    .describe("true si es un requisito EXCLUYENTE/ELIMINATORIO (descalifica si no se cumple); false si es orientativo/deseable/valorable."),
});

export const ScoringCriterionSchema = z.object({
  name: z.string().describe("Nombre del criterio de valoración/baremo, p.ej. 'Oferta económica', 'Mejoras técnicas'."),
  description: z.string().nullable().describe("Detalle de cómo se puntúa este criterio, si el pliego lo especifica."),
  weightPercent: z.number().min(0).max(100).describe("Peso del criterio en % sobre el total del baremo."),
  maxPoints: z.number().nullable().describe("Puntuación máxima si el pliego usa una escala de puntos en vez de/además de %."),
});

export const ExecutiveSummarySchema = z.object({
  scopeSummary: z
    .string()
    .describe("Resumen del alcance/objeto del contrato en 2-4 frases, en español, para alguien que no ha leído el pliego."),
  submissionDeadline: z
    .string()
    .nullable()
    .describe("Fecha límite de presentación de ofertas, formato ISO 8601 YYYY-MM-DD. null si no se especifica una fecha concreta."),
  clarificationDeadline: z
    .string()
    .nullable()
    .describe("Fecha límite para solicitar aclaraciones/preguntas, formato ISO 8601 YYYY-MM-DD. null si no se especifica."),
  maxBudget: z
    .number()
    .nullable()
    .describe("Presupuesto base de licitación o importe máximo, en unidades enteras de la divisa (sin céntimos). null si no se especifica."),
  currency: z.string().describe("Código de divisa ISO 4217, p.ej. 'EUR'. Por defecto 'EUR' si el pliego no lo indica y es una licitación española."),
  contractDurationMonths: z.number().nullable().describe("Duración del contrato en meses, si se especifica."),
  contractingBody: z.string().nullable().describe("Organismo público o empresa que licita/contrata, si se identifica en el documento."),
});

export const TenderAnalysisExtractionSchema = z.object({
  executiveSummary: ExecutiveSummarySchema,
  exclusionRequirements: z
    .array(ExclusionRequirementSchema)
    .describe("Todos los requisitos excluyentes/eliminatorios y de solvencia encontrados en el pliego. Array vacío si genuinamente no hay ninguno."),
  scoringCriteria: z
    .array(ScoringCriterionSchema)
    .describe("Criterios de baremo/adjudicación con sus pesos, si el pliego los detalla. Array vacío si no hay baremo o es 'mejor precio' sin desglose."),
  requirementsSectionUnclear: z
    .boolean()
    .describe(
      "true SOLO si el documento no tiene una sección de requisitos de solvencia/admisión clara y los datos extraídos " +
        "son una estimación de mejor esfuerzo a partir de menciones dispersas; false en el caso normal."
    ),
});

export type RequirementCategory = z.infer<typeof RequirementCategorySchema>;
export type ExclusionRequirementExtraction = z.infer<typeof ExclusionRequirementSchema>;
export type ScoringCriterionExtraction = z.infer<typeof ScoringCriterionSchema>;
export type ExecutiveSummaryExtraction = z.infer<typeof ExecutiveSummarySchema>;
export type TenderAnalysisExtraction = z.infer<typeof TenderAnalysisExtractionSchema>;
