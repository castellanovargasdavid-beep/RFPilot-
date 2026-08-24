import { notFound, redirect } from "next/navigation";

import { requireActiveMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { proposalDraftInclude } from "@/server/proposals/detail-select";
import { ProposalEditor } from "@/components/proposals/proposal-editor";

export default async function ProposalPage({ params }: { params: { id: string } }) {
  const membership = await requireActiveMembership();

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!tender) notFound();

  const draft = await prisma.proposalDraft.findFirst({
    where: { tenderId: tender.id },
    orderBy: { createdAt: "desc" },
    include: proposalDraftInclude,
  });

  if (!draft) {
    redirect(`/dashboard/tenders/${tender.id}`);
  }

  return <ProposalEditor initial={draft} tenderId={tender.id} />;
}
