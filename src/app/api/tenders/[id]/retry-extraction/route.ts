import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: { id: true, status: true },
  });
  if (!tender) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (tender.status !== "EXTRACTION_FAILED") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  await inngest.send({ name: "tender/uploaded", data: { tenderId: tender.id } });

  return NextResponse.json({ ok: true });
}
