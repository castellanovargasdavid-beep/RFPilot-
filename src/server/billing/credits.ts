import { prisma } from "@/lib/prisma";
import type { CreditReason } from "@prisma/client";

/** El saldo de créditos es el balanceAfter de la entrada más reciente del ledger (append-only). */
export async function getCreditBalance(organizationId: string): Promise<number> {
  const last = await prisma.creditLedgerEntry.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return last?.balanceAfter ?? 0;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Créditos insuficientes.");
  }
}

/**
 * Descuenta créditos de forma segura ante escrituras concurrentes: lee el
 * saldo y escribe la nueva entrada dentro de la misma transacción
 * serializable, así dos análisis lanzados a la vez no pueden ambos ver
 * saldo suficiente y dejar el balance en negativo.
 */
export async function consumeCredits(
  organizationId: string,
  amount: number,
  reason: CreditReason,
  relatedTenderId?: string
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const last = await tx.creditLedgerEntry.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });
      const currentBalance = last?.balanceAfter ?? 0;

      if (currentBalance < amount) {
        throw new InsufficientCreditsError();
      }

      await tx.creditLedgerEntry.create({
        data: {
          organizationId,
          delta: -amount,
          reason,
          relatedTenderId,
          balanceAfter: currentBalance - amount,
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
}

export async function refundCredits(
  organizationId: string,
  amount: number,
  relatedTenderId?: string
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const last = await tx.creditLedgerEntry.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });
      const currentBalance = last?.balanceAfter ?? 0;

      await tx.creditLedgerEntry.create({
        data: {
          organizationId,
          delta: amount,
          reason: "REFUND",
          relatedTenderId,
          balanceAfter: currentBalance + amount,
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
}
