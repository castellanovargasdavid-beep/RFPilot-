import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  generateProposalOutline,
  PROPOSAL_OUTLINE_PROMPT_VERSION,
} from "@/ai/generate-proposal-outline";
import type { ProposalSectionNode } from "@/ai/schemas/proposal-outline";

async function createSectionTree(draftId: string, parentId: string | null, nodes: ProposalSectionNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const section = await prisma.proposalSection.create({
      data: {
        draftId,
        parentId,
        order: i,
        title: node.title,
        instructions: node.instructions,
        status: "EMPTY",
      },
    });
    if (node.children.length > 0) {
      await createSectionTree(draftId, section.id, node.children);
    }
  }
}

/**
 * Pipeline paso (d): índice de la propuesta técnica. Crea el árbol de
 * ProposalSection recursivamente a partir del outline devuelto por Claude
 * — el contenido de cada sección se genera aparte, bajo demanda (paso e).
 */
export const generateProposalOutlineFunction = inngest.createFunction(
  { id: "generate-proposal-outline", retries: 1 },
  { event: "proposal/outline.requested" },
  async ({ event, step }) => {
    const { draftId } = event.data;

    const draft = await step.run("load-draft", async () => {
      return prisma.proposalDraft.findUniqueOrThrow({ where: { id: draftId }, include: { tender: true } });
    });

    let outlineResult;
    try {
      outlineResult = await step.run("generate-outline", async () => {
        if (!draft.tender.extractedText) {
          throw new Error("El pliego no tiene texto extraído todavía.");
        }
        return generateProposalOutline(draft.tender.extractedText);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al generar el índice de la propuesta.";
      await step.run("mark-outline-failed", async () => {
        await prisma.proposalDraft.update({ where: { id: draftId }, data: { status: "FAILED", errorMessage: message } });
      });
      throw error;
    }

    await step.run("save-outline", async () => {
      const { outline, usage } = outlineResult;
      await createSectionTree(draftId, null, outline.sections);
      await prisma.$transaction([
        prisma.proposalDraft.update({ where: { id: draftId }, data: { status: "DRAFT", errorMessage: null } }),
        prisma.aiUsageLog.create({
          data: {
            organizationId: draft.tender.organizationId,
            tenderId: draft.tenderId,
            userId: draft.tender.uploadedById,
            step: "proposal-outline",
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
            costCents: usage.costCents,
            durationMs: usage.durationMs,
          },
        }),
      ]);
    });

    return { draftId, promptVersion: PROPOSAL_OUTLINE_PROMPT_VERSION };
  }
);
