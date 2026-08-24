import { prisma } from "@/lib/prisma";

/** El saldo de créditos es el balanceAfter de la entrada más reciente del ledger (append-only). */
export async function getCreditBalance(organizationId: string): Promise<number> {
  const last = await prisma.creditLedgerEntry.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return last?.balanceAfter ?? 0;
}
