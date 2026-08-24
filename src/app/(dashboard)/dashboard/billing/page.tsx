import { CreditCard } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function BillingPage() {
  return (
    <ComingSoon
      icon={CreditCard}
      title="Facturación y créditos"
      description="Gestiona tu plan, revisa el consumo de créditos del mes y accede al portal de facturación de Stripe."
      phase="la Fase 6"
    />
  );
}
