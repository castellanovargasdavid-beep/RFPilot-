import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TenderStatus } from "@prisma/client";

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
