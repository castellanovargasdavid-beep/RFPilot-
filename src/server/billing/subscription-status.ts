import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "incomplete":
      return "INCOMPLETE";
    case "canceled":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
    default:
      return "CANCELED";
  }
}

/**
 * `current_period_end` ha cambiado de sitio entre versiones recientes de
 * la API de Stripe (a veces vive en la suscripción, a veces solo en cada
 * subscription item). Se comprueba en ambos sitios para no romper según
 * la versión de API configurada en el dashboard de Stripe del proyecto —
 * verifica esto contra tu versión real antes de confiar en ello a ciegas.
 */
export function extractCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const topLevel = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof topLevel === "number") return new Date(topLevel * 1000);

  const itemLevel = subscription.items.data[0]?.current_period_end;
  if (typeof itemLevel === "number") return new Date(itemLevel * 1000);

  return null;
}
