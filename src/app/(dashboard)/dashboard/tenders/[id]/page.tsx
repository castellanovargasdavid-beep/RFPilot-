import { notFound } from "next/navigation";

import { requireActiveMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { tenderDetailSelect } from "@/server/tenders/detail-select";
import { TenderStatusView } from "@/components/tenders/tender-status-view";

export default async function TenderDetailPage({ params }: { params: { id: string } }) {
  const membership = await requireActiveMembership();

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: tenderDetailSelect,
  });

  if (!tender) {
    notFound();
  }

  return <TenderStatusView initial={tender} />;
}
