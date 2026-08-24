import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { generateSectionContent, SECTION_GENERATION_PROMPT_VERSION } from "@/ai/generate-section-content";
import { getOrCreateDefaultProfile, getProfileView } from "@/server/company-profile/repository";
import { summarizeProfileForPrompt } from "@/server/company-profile/summarize";

async function buildBreadcrumb(sectionId: string | null): Promise<string[]> {
  const titles: string[] = [];
  let currentId = sectionId;
  while (currentId) {
    const section = await prisma.proposalSection.findUnique({
      where: { id: currentId },
      select: { title: true, parentId: true },
    });
    if (!section) break;
    titles.unshift(section.title);
    currentId = section.parentId;
  }
  return titles;
}

/**
 * Pipeline paso (e): contenido de UNA sección bajo demanda. Se dispara al
 * pulsar "Generar"/"Regenerar con IA" en una sección concreta — nunca se
 * generan todas de golpe, para controlar coste y permitir iterar sección
 * por sección.
 */
export const generateProposalSectionFunction = inngest.createFunction(
  { id: "generate-proposal-section", retries: 1 },
  { event: "proposal/section.generation.requested" },
  async ({ event, step }) => {
    const { sectionId } = event.data;

    const section = await step.run("load-section", async () => {
      return prisma.proposalSection.findUniqueOrThrow({
        where: { id: sectionId },
        include: { draft: { include: { tender: true } } },
      });
    });

    const breadcrumb = await step.run("build-breadcrumb", async () => buildBreadcrumb(section.parentId));

    let result;
    try {
      result = await step.run("generate-content", async () => {
        const { draft } = section;
        if (!draft.tender.extractedText) {
          throw new Error("El pliego no tiene texto extraído todavía.");
        }

        const profileId = draft.companyProfileId ?? (await getOrCreateDefaultProfile(draft.tender.organizationId)).id;
        const profile = await getProfileView(profileId, draft.tender.organizationId);

        return generateSectionContent({
          tenderText: draft.tender.extractedText,
          sectionTitle: section.title,
          sectionInstructions: section.instructions,
          breadcrumb,
          companyProfileSummary: profile ? summarizeProfileForPrompt(profile) : "",
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al generar el contenido de la sección.";
      await step.run("mark-section-failed", async () => {
        await prisma.proposalSection.update({ where: { id: sectionId }, data: { status: "FAILED", errorMessage: message } });
      });
      throw error;
    }

    await step.run("save-section-content", async () => {
      const { content, usage } = result;
      await prisma.$transaction([
        prisma.proposalSection.update({
          where: { id: sectionId },
          data: { content, status: "GENERATED", errorMessage: null },
        }),
        prisma.aiUsageLog.create({
          data: {
            organizationId: section.draft.tender.organizationId,
            tenderId: section.draft.tenderId,
            userId: section.draft.tender.uploadedById,
            step: "section-generation",
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

    return { sectionId, promptVersion: SECTION_GENERATION_PROMPT_VERSION };
  }
);
