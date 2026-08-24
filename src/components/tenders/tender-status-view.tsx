"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, RotateCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TenderStatusBadge } from "@/components/tenders/status-badge";
import type { TenderStatus } from "@prisma/client";

interface TenderStatusData {
  id: string;
  title: string;
  status: TenderStatus;
  statusMessage: string | null;
  pageCount: number | null;
  extractedTextIsOcr: boolean;
  extractionMethod: string | null;
  fileName: string;
  fileSizeBytes: number;
}

const POLLING_STATUSES: TenderStatus[] = ["UPLOADING", "EXTRACTING", "ANALYZING"];
const POLL_INTERVAL_MS = 2000;

export function TenderStatusView({ initial }: { initial: TenderStatusData }) {
  const [tender, setTender] = useState(initial);
  const [retrying, setRetrying] = useState(false);

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

  async function handleRetry() {
    setRetrying(true);
    await fetch(`/api/tenders/${tender.id}/retry-extraction`, { method: "POST" });
    setTender((t) => ({ ...t, status: "EXTRACTING", statusMessage: null }));
    setRetrying(false);
  }

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

      {(tender.status === "UPLOADING" || tender.status === "EXTRACTING") && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-8 w-8 animate-pulse text-primary" />
            <p className="font-medium">
              {tender.status === "UPLOADING" ? "Preparando el documento…" : "Extrayendo el texto del pliego…"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Los pliegos escaneados pueden tardar varios minutos porque pasan por reconocimiento óptico (OCR).
              Puedes salir de esta pantalla, el análisis sigue en segundo plano.
            </p>
          </CardContent>
        </Card>
      )}

      {tender.status === "EXTRACTION_FAILED" && (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <CardTitle className="text-base">No se pudo extraer el texto</CardTitle>
            <CardDescription className="max-w-sm">
              {tender.statusMessage ?? "Ocurrió un error inesperado al procesar el PDF."}
            </CardDescription>
            <Button onClick={handleRetry} disabled={retrying}>
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                El pipeline de análisis con IA (semáforo de elegibilidad, resumen ejecutivo y criterios de
                baremo) se incorpora en la Fase 3 de esta build.
              </p>
            </CardContent>
          </Card>
          <Button disabled className="opacity-60">
            <Sparkles className="h-4 w-4" />
            Analizar con IA (próximamente)
          </Button>
        </>
      )}
    </div>
  );
}
