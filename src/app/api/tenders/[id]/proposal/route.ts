import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { getOrCreateDefaultProfile } from "@/server/company-profile/repository";

/** Devuelve el borrador existente para esta licitación, si lo hay. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const draft = await prisma.proposalDraft.findFirst({
    where: { tenderId: params.id, tender: { organizationId: membership.organizationId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  return NextResponse.json(draft);
}

/** Crea (si no existe) el borrador y dispara la generación del índice. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
  });
  if (!tender) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (tender.status !== "READY") {
    return NextResponse.json({ error: "tender_not_ready" }, { status: 400 });
  }

  const existing = await prisma.proposalDraft.findFirst({
    where: { tenderId: tender.id },
    orderBy: { createdAt: "desc" },
  });
  if (existing && existing.status !== "FAILED") {
    return NextResponse.json({ id: existing.id });
  }

  const profile = await getOrCreateDefaultProfile(membership.organizationId);

  const draft = existing
    ? await prisma.proposalDraft.update({
        where: { id: existing.id },
        data: { status: "GENERATING", errorMessage: null },
      })
    : await prisma.proposalDraft.create({
        data: {
          tenderId: tender.id,
          companyProfileId: profile.id,
          title: `Propuesta técnica — ${tender.title}`,
          status: "GENERATING",
        },
      });

  await inngest.send({ name: "proposal/outline.requested", data: { draftId: draft.id } });

  return NextResponse.json({ id: draft.id });
}
