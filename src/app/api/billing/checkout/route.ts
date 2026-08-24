import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { getStripePriceId } from "@/lib/plans";

const schema = z.object({
  target: z.enum(["PRO", "AGENCY", "PAYG_CREDIT"]),
  quantity: z.number().int().min(1).max(20).default(1),
});

/** Crea (o reutiliza) el customer de Stripe de la organización. */
async function ensureStripeCustomerId(organizationId: string, userEmail: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    name: org.name,
    email: userEmail,
    metadata: { organizationId },
  });

  await prisma.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function POST(request: Request) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const stripe = getStripeClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const user = await prisma.user.findUnique({ where: { id: membership.userId }, select: { email: true } });
  const customerId = await ensureStripeCustomerId(membership.organizationId, user?.email ?? "");

  const { target, quantity } = parsed.data;

  if (target === "PAYG_CREDIT") {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: getStripePriceId("PAYG_CREDIT"), quantity }],
      success_url: `${appUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/billing?checkout=cancelled`,
      metadata: { organizationId: membership.organizationId, kind: "PAYG_CREDIT", credits: String(quantity) },
    });
    return NextResponse.json({ url: checkoutSession.url });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getStripePriceId(target), quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard/billing?checkout=cancelled`,
    subscription_data: { metadata: { organizationId: membership.organizationId, plan: target } },
    metadata: { organizationId: membership.organizationId, kind: "SUBSCRIPTION", plan: target },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
