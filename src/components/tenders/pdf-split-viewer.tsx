"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PdfHighlightTarget {
  page: number;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  /** Incrementa en cada click para forzar el re-scroll aunque el usuario pida la misma cita dos veces seguidas. */
  nonce: number;
}

/**
 * Visor de PDF en el propio navegador (split-screen con la lista de
 * requisitos) que hace scroll automático a la página citada y resalta el
 * bounding box exacto del texto original — ver ARCHITECTURE.md § RAG
 * estructural. Usa pdfjs-dist en cliente contra el proxy autenticado
 * /api/tenders/[id]/file (nunca la URL directa de Blob).
 */
export function PdfSplitViewer({ tenderId, target }: { tenderId: string; target: PdfHighlightTarget | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjsLib.getDocument(`/api/tenders/${tenderId}/file`);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar el PDF para previsualizar.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenderId]);

  useEffect(() => {
    if (target) setCurrentPage(target.page);
  }, [target?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || loading) return;
    let cancelled = false;

    (async () => {
      setRendering(true);
      try {
        const page = await pdf.getPage(Math.min(Math.max(currentPage, 1), pdf.numPages));
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) return;
        await page.render({ canvasContext: context, viewport }).promise;
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentPage, loading]);

  useEffect(() => {
    if (target && !rendering) {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [target?.nonce, rendering]); // eslint-disable-line react-hooks/exhaustive-deps

  const showHighlight = target && target.page === currentPage;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {currentPage} de {numPages || "…"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={currentPage >= numPages}
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        {!loading && !error && (
          <div className="relative mx-auto inline-block max-w-full">
            <canvas ref={canvasRef} className="block h-auto max-w-full shadow-md" />
            {showHighlight && (
              <div
                ref={highlightRef}
                className="absolute animate-pulse rounded-sm border-2 border-warning bg-warning/25"
                style={{
                  left: `${target.bboxX * 100}%`,
                  top: `${target.bboxY * 100}%`,
                  width: `${Math.max(target.bboxW, 0.02) * 100}%`,
                  height: `${Math.max(target.bboxH, 0.02) * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
