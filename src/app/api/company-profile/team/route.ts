import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { addTeamMember, getOrCreateDefaultProfile } from "@/server/company-profile/repository";

const schema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  yearsExperience: z.number().int().nonnegative().nullable().optional(),
  qualifications: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  const member = await addTeamMember(profile.id, membership.organizationId, parsed.data);

  return NextResponse.json(member);
}
