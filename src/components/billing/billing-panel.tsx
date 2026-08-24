"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLAN_CONFIG } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import type { PlanType, SubscriptionStatus, CreditReason } from "@prisma/client";

const REASON_LABELS: Record<CreditReason, string> = {
  PLAN_GRANT: "Crédito de plan",
  PAY_AS_YOU_GO_PURCHASE: "Compra de créditos",
  TENDER_ANALYSIS: "Análisis de licitación",
  PROPOSAL_DRAFT: "Borrador de propuesta",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  REFUND: "Reembolso",
};

interface LedgerEntry {
  id: string;
  delta: number;
  reason: CreditReason;
  balanceAfter: number;
  createdAt: Date;
}

export function BillingPanel({
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  hasStripeCustomer,
  creditBalance,
  recentEntries,
}: {
  plan: PlanType;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  creditBalance: number;
  recentEntries: LedgerEntry[];
}) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  async function handleCheckout(target: "PRO" | "AGENCY" | "PAYG_CREDIT") {
    setBillingError(null);
    setLoadingAction(target);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, quantity: 1 }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
      return;
    }
    const data = await res.json().catch(() => ({}));
    setBillingError(
      data.error === "stripe_not_configured"
        ? "Los pagos todavía no están configurados en este entorno."
        : "No se pudo iniciar el pago. Inténtalo de nuevo."
    );
    setLoadingAction(null);
  }

  async function handlePortal() {
    setBillingError(null);
    setLoadingAction("portal");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
      return;
    }
    const data = await res.json().catch(() => ({}));
    setBillingError(
      data.error === "stripe_not_configured"
        ? "Los pagos todavía no están configurados en este entorno."
        : "No se pudo abrir el portal de facturación."
    );
    setLoadingAction(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturación y plan</h1>
        <p className="text-muted-foreground">Gestiona tu plan y revisa el consumo de créditos.</p>
      </div>

      {billingError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{billingError}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{PLAN_CONFIG[plan].label}</p>
            {subscriptionStatus && subscriptionStatus !== "ACTIVE" && (
              <Badge variant="destructive">{subscriptionStatus}</Badge>
            )}
            {currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                {cancelAtPeriodEnd ? "Se cancela el " : "Se renueva el "}
                {formatDate(currentPeriodEnd)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Créditos disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {plan === "AGENCY" ? "Ilimitados" : creditBalance}
            </p>
            <p className="text-sm text-muted-foreground">1 crédito = 1 análisis + borrador</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facturación</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handlePortal} disabled={!hasStripeCustomer || loadingAction !== null}>
              {loadingAction === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Gestionar facturación
            </Button>
            {!hasStripeCustomer && (
              <p className="mt-2 text-xs text-muted-foreground">Disponible tras tu primera compra o suscripción.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLAN_CONFIG) as PlanType[]).map((key) => (
          <Card key={key} className={plan === key ? "border-primary" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {PLAN_CONFIG[key].label}
                {plan === key && <Badge>Plan actual</Badge>}
              </CardTitle>
              <p className="text-xl font-semibold">{PLAN_CONFIG[key].priceLabel}</p>
              <CardDescription>{PLAN_CONFIG[key].description}</CardDescription>
            </CardHeader>
            <CardContent>
              {key === "PAY_AS_YOU_GO" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCheckout("PAYG_CREDIT")}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "PAYG_CREDIT" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Comprar 1 crédito
                </Button>
              ) : plan === key ? (
                <Button className="w-full" disabled>
                  <CheckCircle2 className="h-4 w-4" />
                  Plan activo
                </Button>
              ) : (
                <Button className="w-full" onClick={() => handleCheckout(key)} disabled={loadingAction !== null}>
                  {loadingAction === key && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cambiar a {PLAN_CONFIG[key].label}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos de créditos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>{REASON_LABELS[entry.reason]}</TableCell>
                    <TableCell className={entry.delta > 0 ? "text-success" : "text-destructive"}>
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </TableCell>
                    <TableCell>{entry.balanceAfter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
