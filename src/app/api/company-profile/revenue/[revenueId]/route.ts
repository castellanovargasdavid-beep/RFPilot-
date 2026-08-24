import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { deleteRevenueYear, getOrCreateDefaultProfile } from "@/server/company-profile/repository";

export async function DELETE(_request: Request, { params }: { params: { revenueId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  await deleteRevenueYear(params.revenueId, profile.id, membership.organizationId);

  return NextResponse.json({ ok: true });
}
