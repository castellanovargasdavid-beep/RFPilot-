import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

const schema = z.object({ content: z.string() });

export async function PATCH(request: Request, { params }: { params: { sectionId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const section = await prisma.proposalSection.findFirst({
    where: { id: params.sectionId, draft: { tender: { organizationId: membership.organizationId } } },
  });
  if (!section) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.proposalSection.update({
    where: { id: section.id },
    data: { content: parsed.data.content, status: "EDITED" },
  });

  return NextResponse.json({ ok: true });
}
