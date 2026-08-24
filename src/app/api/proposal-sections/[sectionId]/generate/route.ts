import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

export async function POST(_request: Request, { params }: { params: { sectionId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const section = await prisma.proposalSection.findFirst({
    where: { id: params.sectionId, draft: { tender: { organizationId: membership.organizationId } } },
  });
  if (!section) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.proposalSection.update({ where: { id: section.id }, data: { status: "GENERATING", errorMessage: null } });
  await inngest.send({ name: "proposal/section.generation.requested", data: { sectionId: section.id } });

  return NextResponse.json({ ok: true });
}
