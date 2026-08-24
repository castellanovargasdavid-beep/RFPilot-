import { notFound } from "next/navigation";

import { requireActiveMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { TenderStatusView } from "@/components/tenders/tender-status-view";

export default async function TenderDetailPage({ params }: { params: { id: string } }) {
  const membership = await requireActiveMembership();

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: {
      id: true,
      title: true,
      status: true,
      statusMessage: true,
      pageCount: true,
      extractedTextIsOcr: true,
      extractionMethod: true,
      fileName: true,
      fileSizeBytes: true,
    },
  });

  if (!tender) {
    notFound();
  }

  return <TenderStatusView initial={tender} />;
}
