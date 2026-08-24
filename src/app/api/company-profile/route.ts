import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { getOrCreateDefaultProfile, getProfileView, updateProfileBasicInfo } from "@/server/company-profile/repository";

export async function GET() {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  const view = await getProfileView(profile.id, membership.organizationId);

  return NextResponse.json(view);
}

const updateSchema = z.object({
  name: z.string().min(1),
  taxId: z.string().nullable().optional(),
  legalForm: z.string().nullable().optional(),
  foundedYear: z.number().int().nullable().optional(),
  employeeCount: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  await updateProfileBasicInfo(profile.id, membership.organizationId, parsed.data);

  return NextResponse.json({ ok: true });
}
