import { z } from "zod/v4";

export interface ProposalSectionNode {
  title: string;
  instructions: string;
  children: ProposalSectionNode[];
}

// Schema recursivo: zod v4 necesita la anotación explícita de tipo en
// z.lazy() para que TypeScript pueda inferir el árbol sin recursión infinita.
export const ProposalSectionSchema: z.ZodType<ProposalSectionNode> = z.lazy(() =>
  z.object({
    title: z.string().describe("Título de la sección/apartado, tal como debería aparecer en el índice de la propuesta técnica."),
    instructions: z
      .string()
      .describe("Qué debe contener esta sección según lo exigido por el pliego (2-3 frases guía para redactarla)."),
    children: z
      .array(ProposalSectionSchema)
      .describe("Subsecciones, si las hay. Array vacío si esta sección no se subdivide."),
  })
);

export const ProposalOutlineSchema = z.object({
  sections: z
    .array(ProposalSectionSchema)
    .min(1)
    .describe("Índice completo de la propuesta técnica, en el orden exigido por el pliego."),
});

export type ProposalOutlineExtraction = z.infer<typeof ProposalOutlineSchema>;
