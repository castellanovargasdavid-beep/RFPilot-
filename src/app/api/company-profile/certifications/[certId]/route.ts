import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { deleteCertification, getOrCreateDefaultProfile } from "@/server/company-profile/repository";

export async function DELETE(_request: Request, { params }: { params: { certId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  await deleteCertification(params.certId, profile.id, membership.organizationId);

  return NextResponse.json({ ok: true });
}
