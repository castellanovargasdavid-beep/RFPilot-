import type { PlanType } from "@prisma/client";

export const PLAN_CONFIG: Record<
  PlanType,
  {
    label: string;
    priceLabel: string;
    monthlyCredits: number | null; // null = ilimitado
    description: string;
  }
> = {
  PAY_AS_YOU_GO: {
    label: "Pay-as-you-go",
    priceLabel: "49€ / licitación",
    monthlyCredits: 0,
    description: "Compra créditos sueltos, sin suscripción. Ideal para uso ocasional.",
  },
  PRO: {
    label: "Pro",
    priceLabel: "129€ / mes",
    monthlyCredits: 5,
    description: "5 análisis + borradores + alertas de boletines oficiales al mes.",
  },
  AGENCY: {
    label: "Corporate",
    priceLabel: "349€ / mes",
    monthlyCredits: null,
    description: "Análisis ilimitados, multi-cliente y marca blanca para consultoras y despachos.",
  },
};

/** Créditos de bienvenida al registrarse, para poder probar el flujo completo. */
export const SIGNUP_TRIAL_CREDITS = 1;

/** 1 crédito = 1 análisis de licitación. La generación de borrador está incluida en el mismo crédito. */
export const CREDIT_COST_TENDER_ANALYSIS = 1;

/** Créditos que otorga cada unidad comprada en pay-as-you-go (1 compra = 1 análisis). */
export const PAYG_CREDITS_PER_UNIT = 1;

/** IDs de precio de Stripe (Dashboard → Product catalog) por plan/producto. */
export function getStripePriceId(target: "PRO" | "AGENCY" | "PAYG_CREDIT"): string {
  const envVar = {
    PRO: process.env.STRIPE_PRICE_PRO,
    AGENCY: process.env.STRIPE_PRICE_AGENCY,
    PAYG_CREDIT: process.env.STRIPE_PRICE_PAYG_CREDIT,
  }[target];

  if (!envVar) {
    throw new Error(`Falta configurar el price ID de Stripe para ${target} (ver .env.example).`);
  }
  return envVar;
}
