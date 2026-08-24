import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { addReference, getOrCreateDefaultProfile } from "@/server/company-profile/repository";

const schema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  description: z.string().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  currency: z.string().default("EUR"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
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
  const reference = await addReference(profile.id, membership.organizationId, {
    ...parsed.data,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
  });

  return NextResponse.json(reference);
}
