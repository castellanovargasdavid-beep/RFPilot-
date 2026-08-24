import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/server/billing/credits";
import { PLAN_CONFIG, PAYG_CREDITS_PER_UNIT } from "@/lib/plans";
import { resolvePlanFromPriceId } from "@/server/billing/resolve-plan";
import { mapStripeSubscriptionStatus, extractCurrentPeriodEnd } from "@/server/billing/subscription-status";

/**
 * Todos los handlers son idempotentes por diseño (upsert por
 * organizationId, o comprobando el motivo antes de conceder créditos) —
 * Stripe puede reenviar el mismo evento más de una vez.
 */
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: `Firma inválida: ${(error as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      if (!organizationId) break;

      if (session.mode === "payment" && session.metadata?.kind === "PAYG_CREDIT") {
        const credits = Number(session.metadata.credits ?? PAYG_CREDITS_PER_UNIT);
        await grantCredits(organizationId, credits, "PAY_AS_YOU_GO_PURCHASE", { checkoutSessionId: session.id });
      }

      if (session.mode === "subscription" && typeof session.subscription === "string") {
        await syncSubscriptionFromStripe(organizationId, session.subscription);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;
      if (organizationId) {
        await syncSubscriptionFromStripe(organizationId, subscription.id, subscription);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;
      if (organizationId) {
        await prisma.subscription.updateMany({
          where: { organizationId },
          data: { status: "CANCELED" },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof (invoice as unknown as { subscription?: string | null }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : null;
      // Solo renovaciones (no la factura inicial, que ya concede créditos vía checkout.session.completed).
      if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const organizationId = subscription.metadata?.organizationId;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? resolvePlanFromPriceId(priceId) : null;

        if (organizationId && plan) {
          const monthlyCredits = PLAN_CONFIG[plan].monthlyCredits;
          if (monthlyCredits && monthlyCredits > 0) {
            await grantCredits(organizationId, monthlyCredits, "PLAN_GRANT", { invoiceId: invoice.id, plan });
          }
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function syncSubscriptionFromStripe(
  organizationId: string,
  subscriptionId: string,
  preloaded?: Stripe.Subscription
) {
  const stripe = getStripeClient();
  const subscription = preloaded ?? (await stripe.subscriptions.retrieve(subscriptionId));
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? resolvePlanFromPriceId(priceId) : null;
  if (!plan) return;

  const status = mapStripeSubscriptionStatus(subscription.status);
  const currentPeriodEnd = extractCurrentPeriodEnd(subscription);

  const existing = await prisma.subscription.findUnique({ where: { organizationId } });

  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan,
      status,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      plan,
      status,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Concede los créditos del primer periodo del plan Pro solo la primera vez que se activa esta suscripción.
  if (plan === "PRO" && status === "ACTIVE" && existing?.stripeSubscriptionId !== subscription.id) {
    const monthlyCredits = PLAN_CONFIG.PRO.monthlyCredits;
    if (monthlyCredits) {
      await grantCredits(organizationId, monthlyCredits, "PLAN_GRANT", { subscriptionId: subscription.id, initial: true });
    }
  }
}
