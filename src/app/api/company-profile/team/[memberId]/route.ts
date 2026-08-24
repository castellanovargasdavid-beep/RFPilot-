import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { deleteTeamMember, getOrCreateDefaultProfile } from "@/server/company-profile/repository";

export async function DELETE(_request: Request, { params }: { params: { memberId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  await deleteTeamMember(params.memberId, profile.id, membership.organizationId);

  return NextResponse.json({ ok: true });
}
