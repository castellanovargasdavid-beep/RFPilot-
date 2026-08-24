import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: membership.organizationId } });
  if (!org.stripeCustomerId) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
