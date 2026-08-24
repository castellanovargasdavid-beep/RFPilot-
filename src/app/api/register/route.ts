import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { slugify, randomSuffix } from "@/lib/slug";
import { SIGNUP_TRIAL_CREDITS } from "@/lib/plans";

const registerSchema = z.object({
  name: z.string().min(2, "Introduce tu nombre"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  organizationName: z.string().min(2, "Introduce el nombre de tu empresa/despacho"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password, organizationName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const baseSlug = slugify(organizationName) || "org";

  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.organization.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${baseSlug}-${randomSuffix(4)}`;
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });

    const organization = await tx.organization.create({
      data: { name: organizationName, slug },
    });

    await tx.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
    });

    await tx.subscription.create({
      data: { organizationId: organization.id, plan: "PAY_AS_YOU_GO", status: "ACTIVE" },
    });

    await tx.creditLedgerEntry.create({
      data: {
        organizationId: organization.id,
        delta: SIGNUP_TRIAL_CREDITS,
        reason: "PLAN_GRANT",
        balanceAfter: SIGNUP_TRIAL_CREDITS,
        metadata: { note: "Crédito de bienvenida" },
      },
    });

    return { user, organization };
  });

  return NextResponse.json({ ok: true, organizationSlug: result.organization.slug });
}
