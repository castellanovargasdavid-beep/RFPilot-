import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { consumeCredits, InsufficientCreditsError } from "@/server/billing/credits";
import { CREDIT_COST_TENDER_ANALYSIS } from "@/lib/plans";

const ANALYZABLE_STATUSES = ["EXTRACTED", "ANALYSIS_FAILED"];

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: { id: true, status: true, extractedText: true },
  });
  if (!tender) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!ANALYZABLE_STATUSES.includes(tender.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if (!tender.extractedText) {
    return NextResponse.json({ error: "no_extracted_text" }, { status: 400 });
  }

  try {
    await consumeCredits(membership.organizationId, CREDIT_COST_TENDER_ANALYSIS, "TENDER_ANALYSIS", tender.id);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    throw error;
  }

  await prisma.tender.update({
    where: { id: tender.id },
    data: { status: "ANALYZING", statusMessage: null },
  });

  await inngest.send({ name: "tender/analysis.requested", data: { tenderId: tender.id } });

  return NextResponse.json({ ok: true });
}
