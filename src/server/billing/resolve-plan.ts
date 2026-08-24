import type { PlanType } from "@prisma/client";

/** Deriva el PlanType interno a partir de un price ID de Stripe, comparando contra las env vars configuradas. */
export function resolvePlanFromPriceId(priceId: string): PlanType | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "AGENCY";
  return null;
}
