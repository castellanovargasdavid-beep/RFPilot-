import type { Prisma } from "@prisma/client";

/**
 * El outline generado por IA se limita a 2 niveles (ver
 * src/ai/prompts/proposal-outline.ts), pero anidamos un nivel extra de
 * margen por si el usuario reestructura secciones manualmente más adelante.
 */
export const proposalDraftInclude = {
  sections: {
    where: { parentId: null },
    orderBy: { order: "asc" },
    include: {
      children: {
        orderBy: { order: "asc" },
        include: {
          children: { orderBy: { order: "asc" } },
        },
      },
    },
  },
} satisfies Prisma.ProposalDraftInclude;

export type ProposalDraftDetail = Prisma.ProposalDraftGetPayload<{ include: typeof proposalDraftInclude }>;
