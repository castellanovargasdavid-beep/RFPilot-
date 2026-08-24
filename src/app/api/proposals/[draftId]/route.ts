import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { proposalDraftInclude } from "@/server/proposals/detail-select";

export async function GET(_request: Request, { params }: { params: { draftId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const draft = await prisma.proposalDraft.findFirst({
    where: { id: params.draftId, tender: { organizationId: membership.organizationId } },
    include: proposalDraftInclude,
  });
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(draft);
}
