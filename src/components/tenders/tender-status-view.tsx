"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  FileText,
  Loader2,
  RotateCw,
  ScrollText,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TenderStatusBadge, EligibilityBadge } from "@/components/tenders/status-badge";
import { formatCurrency, formatDate, daysUntil, cn } from "@/lib/utils";
import type { TenderDetail } from "@/server/tenders/detail-select";

const POLLING_STATUSES = ["UPLOADING", "EXTRACTING", "ANALYZING"];
const POLL_INTERVAL_MS = 2500;
const REQUIREMENT_CATEGORY_LABELS: Record<string, string> = {
  CERTIFICATION: "Certificación",
  FINANCIAL: "Solvencia económica",
  TECHNICAL_EXPERIENCE: "Solvencia técnica",
  LEGAL_ADMINISTRATIVE: "Administrativo/legal",
  TEAM_QUALIFICATION: "Equipo",
  INSURANCE: "Seguro",
  OTHER: "Otro",
};

interface ExecutiveSummary {
  scopeSummary: string;
  submissionDeadline: string | null;
  clarificationDeadline: string | null;
  maxBudget: number | null;
  currency: string;
  contractDurationMonths: number | null;
  contractingBody: string | null;
}

export function TenderStatusView({ initial }: { initial: TenderDetail }) {
  const router = useRouter();
  const [tender, setTender] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [updatingEligibility, setUpdatingEligibility] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);

  useEffect(() => {
    if (!POLLING_STATUSES.includes(tender.status)) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/tenders/${tender.id}`);
      if (res.ok) {
        setTender(await res.json());
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [tender.status, tender.id]);

  async function handleRetryExtraction() {
    setRetrying(true);
    await fetch(`/api/tenders/${tender.id}/retry-extraction`, { method: "POST" });
    setTender((t) => ({ ...t, status: "EXTRACTING", statusMessage: null }));
    setRetrying(false);
  }

  async function handleAnalyze() {
    setAnalyzeError(null);
    setAnalyzing(true);
    const res = await fetch(`/api/tenders/${tender.id}/analyze`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAnalyzeError(
        data.error === "insufficient_credits"
          ? "No te quedan créditos suficientes para analizar esta licitación."
          : "No se pudo iniciar el análisis. Inténtalo de nuevo."
      );
      setAnalyzing(false);
      return;
    }
    setTender((t) => ({ ...t, status: "ANALYZING", statusMessage: null }));
    setAnalyzing(false);
  }

  async function handleUpdateEligibility() {
    setUpdatingEligibility(true);
    const res = await fetch(`/api/tenders/${tender.id}/eligibility`, { method: "POST" });
    if (res.ok) {
      const refreshed = await fetch(`/api/tenders/${tender.id}`);
      if (refreshed.ok) setTender(await refreshed.json());
    }
    setUpdatingEligibility(false);
  }

  async function handleGenerateProposal() {
    setGeneratingProposal(true);
    const res = await fetch(`/api/tenders/${tender.id}/proposal`, { method: "POST" });
    if (res.ok) {
      router.push(`/dashboard/tenders/${tender.id}/proposal`);
      return;
    }
    setGeneratingProposal(false);
  }

  const analysis = tender.analyses[0];
  const summary = analysis?.executiveSummaryJson as ExecutiveSummary | null | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tender.title}</h1>
          <p className="text-sm text-muted-foreground">
            {tender.fileName} · {(tender.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <TenderStatusBadge status={tender.status} />
      </div>

      {(tender.status === "UPLOADING" || tender.status === "EXTRACTING" || tender.status === "ANALYZING") && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-8 w-8 animate-pulse text-primary" />
            <p className="font-medium">
              {tender.status === "UPLOADING" && "Preparando el documento…"}
              {tender.status === "EXTRACTING" && "Extrayendo el texto del pliego…"}
              {tender.status === "ANALYZING" && "Analizando requisitos y resumen ejecutivo con IA…"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {tender.status === "ANALYZING"
                ? "Puede tardar uno o dos minutos en pliegos largos. Puedes salir de esta pantalla."
                : "Los pliegos escaneados pueden tardar varios minutos porque pasan por reconocimiento óptico (OCR)."}
            </p>
          </CardContent>
        </Card>
      )}

      {(tender.status === "EXTRACTION_FAILED" || tender.status === "ANALYSIS_FAILED") && (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <CardTitle className="text-base">
              {tender.status === "EXTRACTION_FAILED" ? "No se pudo extraer el texto" : "El análisis con IA falló"}
            </CardTitle>
            <CardDescription className="max-w-sm">
              {tender.statusMessage ?? "Ocurrió un error inesperado."}
              {tender.status === "ANALYSIS_FAILED" && " Se te ha reembolsado el crédito consumido."}
            </CardDescription>
            <Button
              onClick={tender.status === "EXTRACTION_FAILED" ? handleRetryExtraction : handleAnalyze}
              disabled={retrying || analyzing}
            >
              <RotateCw className="h-4 w-4" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {tender.status === "EXTRACTED" && (
        <>
          {tender.statusMessage && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="flex items-center gap-3 py-4 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                {tender.statusMessage}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extracción completada</CardTitle>
              <CardDescription>
                {tender.pageCount} páginas ·{" "}
                {tender.extractedTextIsOcr
                  ? "texto reconocido por OCR (documento escaneado)"
                  : "texto extraído directamente del PDF"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Analiza el pliego con IA para ver el semáforo de requisitos excluyentes y el resumen ejecutivo
                (plazos, presupuesto, criterios de baremo). Consume 1 crédito.
              </p>
              {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}
              <Button onClick={handleAnalyze} disabled={analyzing}>
                <Sparkles className="h-4 w-4" />
                Analizar con IA
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {tender.status === "READY" && analysis && (
        <div className="space-y-6">
          {analysis.requirementsSectionUnclear && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="flex items-center gap-3 py-4 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                Este pliego no tiene una sección de requisitos de solvencia/admisión claramente delimitada — la
                extracción es una estimación de mejor esfuerzo. Revisa el documento original antes de descartar la
                licitación.
              </CardContent>
            </Card>
          )}

          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard icon={ScrollText} label="Alcance" value={summary.scopeSummary} />
              <SummaryCard
                icon={CalendarClock}
                label="Presentación de ofertas"
                value={summary.submissionDeadline ? formatDate(summary.submissionDeadline) : "No especificado"}
                badge={
                  summary.submissionDeadline
                    ? `${daysUntil(summary.submissionDeadline)} días restantes`
                    : undefined
                }
              />
              <SummaryCard
                icon={Wallet}
                label="Presupuesto máximo"
                value={summary.maxBudget ? formatCurrency(summary.maxBudget, summary.currency) : "No especificado"}
              />
              <SummaryCard
                icon={Calendar}
                label="Duración del contrato"
                value={summary.contractDurationMonths ? `${summary.contractDurationMonths} meses` : "No especificado"}
              />
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Requisitos excluyentes</CardTitle>
                <CardDescription>
                  {analysis.eligibilityStatus
                    ? "Semáforo cruzado contra tu perfil de empresa."
                    : "Aún no se ha cruzado contra tu perfil de empresa."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {analysis.eligibilityStatus && <EligibilityBadge status={analysis.eligibilityStatus} />}
                <Button variant="outline" size="sm" onClick={handleUpdateEligibility} disabled={updatingEligibility}>
                  {updatingEligibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  Actualizar semáforo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.requirements.length === 0 && (
                <p className="text-sm text-muted-foreground">No se identificaron requisitos excluyentes explícitos.</p>
              )}
              {analysis.requirements.map((req) => (
                <div key={req.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {req.eligibilityCheck && <EligibilityBadge status={req.eligibilityCheck.status} />}
                    <Badge variant="outline">{REQUIREMENT_CATEGORY_LABELS[req.category] ?? req.category}</Badge>
                    {!req.isMandatory && <Badge variant="secondary">Orientativo</Badge>}
                  </div>
                  <p className="mt-2 text-sm font-medium">{req.description}</p>
                  {req.citationText && (
                    <blockquote className="mt-2 border-l-2 pl-3 text-sm italic text-muted-foreground">
                      &ldquo;{req.citationText}&rdquo;
                      {(req.citationPage || req.citationClause) && (
                        <span className="not-italic">
                          {" "}
                          —{req.citationPage ? ` pág. ${req.citationPage}` : ""}
                          {req.citationClause ? ` ${req.citationClause}` : ""}
                        </span>
                      )}
                    </blockquote>
                  )}
                  {req.eligibilityCheck && (
                    <p className="mt-2 text-sm text-muted-foreground">{req.eligibilityCheck.reasoning}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {analysis.scoringCriteria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Criterios de baremo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.scoringCriteria.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.weightPercent}% {c.maxPoints ? `(máx. ${c.maxPoints} pts)` : ""}
                      </span>
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                    <Separator className="mt-3" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Button onClick={handleGenerateProposal} disabled={generatingProposal}>
            {generatingProposal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar borrador de propuesta
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className={cn("text-sm font-medium leading-snug")}>{value}</p>
        {badge && (
          <Badge variant="secondary" className="mt-1">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
