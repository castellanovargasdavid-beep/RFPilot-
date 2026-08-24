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
    priceLabel: "$29 / licitación",
    monthlyCredits: 0,
    description: "Compra créditos sueltos, sin suscripción. Ideal para uso ocasional.",
  },
  PRO: {
    label: "Pro",
    priceLabel: "$79 / mes",
    monthlyCredits: 5,
    description: "5 análisis + borradores + alertas de boletines oficiales al mes.",
  },
  AGENCY: {
    label: "Agencia",
    priceLabel: "$199 / mes",
    monthlyCredits: null,
    description: "Análisis ilimitados, multi-cliente y marca blanca para consultoras.",
  },
};

/** Créditos de bienvenida al registrarse, para poder probar el flujo completo. */
export const SIGNUP_TRIAL_CREDITS = 1;

/** 1 crédito = 1 análisis de licitación. La generación de borrador está incluida en el mismo crédito. */
export const CREDIT_COST_TENDER_ANALYSIS = 1;
