"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileSearch,
  FileText,
  Loader2,
  RotateCw,
  ScrollText,
  ShieldQuestion,
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
import { PdfSplitViewer, type PdfHighlightTarget } from "@/components/tenders/pdf-split-viewer";
import { formatCurrency, formatDate, daysUntil, cn } from "@/lib/utils";
import type { TenderDetail } from "@/server/tenders/detail-select";

const POLLING_STATUSES = ["UPLOADING", "EXTRACTING", "ANALYZING"];
const POLL_INTERVAL_MS = 2500;
/** Igual que STUCK_EXTRACTING_THRESHOLD_MS en la API de retry-extraction — a
 * partir de aquí ofrecemos reintentar en vez de esperar indefinidamente. */
const STUCK_EXTRACTING_THRESHOLD_MS = 8 * 60 * 1000;
const REQUIREMENT_CATEGORY_LABELS: Record<string, string> = {
  CERTIFICATION: "Certificación",
  FINANCIAL: "Solvencia económica",
  TECHNICAL_EXPERIENCE: "Solvencia técnica",
  LEGAL_ADMINISTRATIVE: "Administrativo/legal",
  TEAM_QUALIFICATION: "Equipo",
  INSURANCE: "Seguro",
  OTHER: "Otro",
};
const LEGAL_TYPE_LABELS: Record<string, string> = {
  SOLVENCIA_ECONOMICA: "Solvencia económica",
  SOLVENCIA_TECNICA: "Solvencia técnica",
  HABILITACION_EMPRESARIAL: "Habilitación empresarial",
  PROHIBICION_CONTRATAR: "Prohibición de contratar",
};
const CERTAINTY_LABELS: Record<string, string> = { ALTO: "Alta", DUDOSO: "Dudosa", AMBIGUO: "Ambigua" };
const PLIEGO_LABELS: Record<string, string> = { PCAP: "PCAP", PPT: "PPT" };

interface CitableItem {
  citationText: string | null;
  citationPage: number | null;
  citationClause: string | null;
  documentoPliego: string | null;
  nivelCerteza: string | null;
  pendienteRevisionHumana: boolean;
  bboxX: number | null;
  bboxY: number | null;
  bboxW: number | null;
  bboxH: number | null;
}

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
  const [highlightTarget, setHighlightTarget] = useState<PdfHighlightTarget | null>(null);
  const [highlightNonce, setHighlightNonce] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleToggleConfirm(requirementId: string, confirmed: boolean) {
    setConfirmingId(requirementId);
    const res = await fetch(`/api/tenders/${tender.id}/requirements/${requirementId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTender((t) => ({
        ...t,
        analyses: t.analyses.map((a) => ({
          ...a,
          requirements: a.requirements.map((r) =>
            r.id === requirementId
              ? { ...r, confirmedByUserId: updated.confirmedByUserId, confirmedAt: updated.confirmedAt }
              : r
          ),
        })),
      }));
    } else {
      toast.error("No se pudo actualizar la confirmación");
    }
    setConfirmingId(null);
  }

  function locateInPdf(item: CitableItem) {
    if (item.citationPage == null || item.bboxX == null || item.bboxY == null || item.bboxW == null || item.bboxH == null) {
      return;
    }
    const nextNonce = highlightNonce + 1;
    setHighlightNonce(nextNonce);
    setHighlightTarget({
      page: item.citationPage,
      bboxX: item.bboxX,
      bboxY: item.bboxY,
      bboxW: item.bboxW,
      bboxH: item.bboxH,
      nonce: nextNonce,
    });
  }

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
    setTender((t) => ({ ...t, status: "EXTRACTING", statusMessage: null, updatedAt: new Date() }));
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
      toast.success("Semáforo actualizado");
    } else {
      toast.error("No se pudo actualizar el semáforo");
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
    toast.error("No se pudo generar el borrador de propuesta");
    setGeneratingProposal(false);
  }

  const analysis = tender.analyses[0];
  const summary = analysis?.executiveSummaryJson as ExecutiveSummary | null | undefined;

  const updatedAtMs = (typeof tender.updatedAt === "string" ? new Date(tender.updatedAt) : tender.updatedAt).getTime();
  const stuckExtracting = tender.status === "EXTRACTING" && Date.now() - updatedAtMs > STUCK_EXTRACTING_THRESHOLD_MS;

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
            {stuckExtracting && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-sm text-muted-foreground">Esto está tardando más de lo normal.</p>
                <Button variant="outline" onClick={handleRetryExtraction} disabled={retrying}>
                  <RotateCw className="h-4 w-4" />
                  Reintentar
                </Button>
              </div>
            )}
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

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="flex items-start gap-3 py-4 text-sm">
                  <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p>
                    <strong>Este análisis es una ayuda automatizada, no un dictamen legal.</strong> Revisa y confirma
                    cada requisito excluyente antes de descartar o presentar una oferta —{" "}
                    <a href="/legal/aviso-legal" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      ver aviso legal
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Requisitos excluyentes</CardTitle>
                    <CardDescription>
                      {analysis.eligibilityStatus
                        ? "Semáforo cruzado contra tu perfil de empresa."
                        : "Aún no se ha cruzado contra tu perfil de empresa."}
                      {analysis.requirements.length > 0 && (
                        <>
                          {" "}
                          · {analysis.requirements.filter((r) => r.confirmedByUserId).length} de{" "}
                          {analysis.requirements.length} confirmados por ti
                        </>
                      )}
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
                    <RequirementCard
                      key={req.id}
                      eligibilityBadge={req.eligibilityCheck && <EligibilityBadge status={req.eligibilityCheck.status} />}
                      categoryLabel={REQUIREMENT_CATEGORY_LABELS[req.category] ?? req.category}
                      legalTypeLabel={req.tipo ? LEGAL_TYPE_LABELS[req.tipo] : null}
                      isMandatory={req.isMandatory}
                      description={req.description}
                      reasoning={req.eligibilityCheck?.reasoning ?? null}
                      item={req}
                      onLocate={() => locateInPdf(req)}
                      confirmed={!!req.confirmedByUserId}
                      confirming={confirmingId === req.id}
                      onToggleConfirm={() => handleToggleConfirm(req.id, !req.confirmedByUserId)}
                    />
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
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{c.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {c.weightPercent}% {c.maxPoints ? `(máx. ${c.maxPoints} pts)` : ""}
                          </span>
                        </div>
                        {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                        <CitationFooter item={c} onLocate={() => locateInPdf(c)} />
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

            <div className="hidden lg:block">
              <Card className="sticky top-6 h-[calc(100vh-8rem)] overflow-hidden p-0">
                <PdfSplitViewer tenderId={tender.id} target={highlightTarget} />
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CitationBadges({ item }: { item: CitableItem }) {
  return (
    <>
      {item.pendienteRevisionHumana && (
        <Badge variant="warning" className="gap-1">
          <ShieldQuestion className="h-3 w-3" />
          Pendiente de revisión
        </Badge>
      )}
      {!item.pendienteRevisionHumana && item.nivelCerteza && item.nivelCerteza !== "ALTO" && (
        <Badge variant="outline">Certeza {CERTAINTY_LABELS[item.nivelCerteza] ?? item.nivelCerteza}</Badge>
      )}
    </>
  );
}

function CitationFooter({ item, onLocate }: { item: CitableItem; onLocate: () => void }) {
  if (!item.citationText) return null;
  const canLocate = item.bboxX != null && item.bboxY != null && item.bboxW != null && item.bboxH != null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <CitationBadges item={item} />
      </div>
      <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
        &ldquo;{item.citationText}&rdquo;
        {(item.citationPage || item.citationClause || item.documentoPliego) && (
          <span className="not-italic">
            {" "}
            —{item.documentoPliego ? ` ${PLIEGO_LABELS[item.documentoPliego] ?? item.documentoPliego},` : ""}
            {item.citationPage ? ` pág. ${item.citationPage}` : ""}
            {item.citationClause ? ` ${item.citationClause}` : ""}
          </span>
        )}
        {canLocate && (
          <Button type="button" variant="link" size="sm" className="ml-1 h-auto p-0 align-baseline not-italic" onClick={onLocate}>
            <Eye className="h-3 w-3" /> Ver en el PDF
          </Button>
        )}
      </blockquote>
    </div>
  );
}

function RequirementCard({
  eligibilityBadge,
  categoryLabel,
  legalTypeLabel,
  isMandatory,
  description,
  reasoning,
  item,
  onLocate,
  confirmed,
  confirming,
  onToggleConfirm,
}: {
  eligibilityBadge: React.ReactNode;
  categoryLabel: string;
  legalTypeLabel: string | null;
  isMandatory: boolean;
  description: string;
  reasoning: string | null;
  item: CitableItem;
  onLocate: () => void;
  confirmed: boolean;
  confirming: boolean;
  onToggleConfirm: () => void;
}) {
  return (
    <div className={cn("rounded-lg border p-4", confirmed && "border-success/40 bg-success/[0.03]")}>
      <div className="flex flex-wrap items-center gap-2">
        {eligibilityBadge}
        <Badge variant="outline">{legalTypeLabel ?? categoryLabel}</Badge>
        {!isMandatory && <Badge variant="secondary">Orientativo</Badge>}
      </div>
      <p className="mt-2 text-sm font-medium">{description}</p>
      <CitationFooter item={item} onLocate={onLocate} />
      {reasoning && <p className="mt-2 text-sm text-muted-foreground">{reasoning}</p>}
      <Button
        type="button"
        variant={confirmed ? "secondary" : "outline"}
        size="sm"
        className="mt-3"
        onClick={onToggleConfirm}
        disabled={confirming}
      >
        {confirming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className={cn("h-3.5 w-3.5", confirmed && "text-success")} />
        )}
        {confirmed ? "Cita revisada por ti" : "He verificado esta cita"}
      </Button>
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
