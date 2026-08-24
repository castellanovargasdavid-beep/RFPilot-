import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { getOrCreateDefaultProfile, upsertRevenueYear } from "@/server/company-profile/repository";

const schema = z.object({
  year: z.number().int().min(2000).max(2100),
  amount: z.number().nonnegative(),
  currency: z.string().default("EUR"),
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
  await upsertRevenueYear(profile.id, membership.organizationId, parsed.data);

  return NextResponse.json({ ok: true });
}
