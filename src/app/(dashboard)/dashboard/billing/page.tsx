import { requireActiveMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { getCreditBalance } from "@/server/billing/credits";
import { BillingPanel } from "@/components/billing/billing-panel";

export default async function BillingPage() {
  const membership = await requireActiveMembership();

  const [subscription, org, creditBalance, recentEntries] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: membership.organizationId } }),
    prisma.organization.findUniqueOrThrow({ where: { id: membership.organizationId } }),
    getCreditBalance(membership.organizationId),
    prisma.creditLedgerEntry.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <BillingPanel
      plan={subscription?.plan ?? "PAY_AS_YOU_GO"}
      subscriptionStatus={subscription?.status ?? null}
      currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
      cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
      hasStripeCustomer={!!org.stripeCustomerId}
      creditBalance={creditBalance}
      recentEntries={recentEntries.map((e) => ({
        id: e.id,
        delta: e.delta,
        reason: e.reason,
        balanceAfter: e.balanceAfter,
        createdAt: e.createdAt,
      }))}
    />
  );
}
