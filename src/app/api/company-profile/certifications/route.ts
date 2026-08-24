import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { addCertification, getOrCreateDefaultProfile } from "@/server/company-profile/repository";

const schema = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable().optional(),
  certificateNumber: z.string().nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
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
  const cert = await addCertification(profile.id, membership.organizationId, {
    name: parsed.data.name,
    issuer: parsed.data.issuer,
    certificateNumber: parsed.data.certificateNumber,
    issuedAt: parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
  });

  return NextResponse.json(cert);
}
