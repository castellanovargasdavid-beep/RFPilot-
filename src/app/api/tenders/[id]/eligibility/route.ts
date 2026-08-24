import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultProfile } from "@/server/company-profile/repository";
import { runEligibilityCrossCheck, NoCompletedAnalysisError, CompanyProfileNotFoundError } from "@/server/eligibility/run-cross-check";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!tender) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const profile = await getOrCreateDefaultProfile(membership.organizationId);

  try {
    const rollup = await runEligibilityCrossCheck(tender.id, profile.id);
    return NextResponse.json(rollup);
  } catch (error) {
    if (error instanceof NoCompletedAnalysisError) {
      return NextResponse.json({ error: "no_completed_analysis" }, { status: 400 });
    }
    if (error instanceof CompanyProfileNotFoundError) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 400 });
    }
    throw error;
  }
}
