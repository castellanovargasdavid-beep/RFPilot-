// IMPORTANTE: estos schemas se pasan a `zodOutputFormat()` del SDK de
// Anthropic, que espera instancias de zod v4 (import "zod/v4"), no v3. El
// resto de la app usa zod v3 normal ("zod") — zod 3.25+ empaqueta ambas
// APIs, así que no hace falta un paquete adicional, solo importar del
// subpath correcto en los archivos que construyen schemas para Claude.
//
// Los schemas de extracción de requisitos/criterios viven ahora en
// pcap-extraction.ts y ppt-extraction.ts (ver ARCHITECTURE.md § RAG
// estructural) — este archivo solo conserva el resumen ejecutivo, que es
// exclusivo del PCAP (plazos, presupuesto, alcance) y se reutiliza tal cual.
import { z } from "zod/v4";

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

export type ExecutiveSummaryExtraction = z.infer<typeof ExecutiveSummarySchema>;
