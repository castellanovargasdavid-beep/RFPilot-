import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { EligibilityStatus, TenderStatus } from "@prisma/client";

const STATUS_CONFIG: Record<TenderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning"; spinning?: boolean }> = {
  UPLOADING: { label: "Subiendo", variant: "secondary", spinning: true },
  EXTRACTING: { label: "Extrayendo texto", variant: "secondary", spinning: true },
  EXTRACTION_FAILED: { label: "Error de extracción", variant: "destructive" },
  EXTRACTED: { label: "Texto listo", variant: "warning" },
  ANALYZING: { label: "Analizando con IA", variant: "secondary", spinning: true },
  ANALYSIS_FAILED: { label: "Error de análisis", variant: "destructive" },
  READY: { label: "Listo", variant: "success" },
};

export function TenderStatusBadge({ status }: { status: TenderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant}>
      {config.spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {config.label}
    </Badge>
  );
}

const ELIGIBILITY_CONFIG: Record<
  EligibilityStatus,
  { label: string; variant: "success" | "warning" | "destructive"; icon: typeof CheckCircle2 }
> = {
  GREEN: { label: "Cumples", variant: "success", icon: CheckCircle2 },
  AMBER: { label: "Revisar", variant: "warning", icon: AlertTriangle },
  RED: { label: "No cumples", variant: "destructive", icon: XCircle },
};

export function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  const config = ELIGIBILITY_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
