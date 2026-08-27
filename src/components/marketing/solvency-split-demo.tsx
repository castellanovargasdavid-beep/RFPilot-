"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, FileSearch } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PcapRequirementType, NivelCerteza, PliegoDocument } from "@/ai/schemas/pcap-extraction";

/**
 * Mockup interactivo de la landing — reutiliza los mismos tipos que el
 * schema Zod real (src/ai/schemas/pcap-extraction.ts) para que la forma de
 * los datos de demo no diverja de la del producto, aunque el "documento"
 * de la derecha sea una simulación visual (no un PDF real, no hay sesión
 * ni licitación subida en la landing) — lo dejamos dicho explícitamente en
 * el pie del panel para no dar a entender que es un render en vivo.
 */
interface MockRequirement {
  id: string;
  tipo: PcapRequirementType;
  descripcion: string;
  cita: string;
  pliego: PliegoDocument;
  clausula: string;
  pagina: number;
  totalPaginas: number;
  nivelCerteza: NivelCerteza;
  status: "green" | "amber" | "red";
  /** Posición vertical (0-100) del recuadro resaltado dentro de la página simulada. */
  highlightTop: number;
}

const REQUIREMENTS: MockRequirement[] = [
  {
    id: "solvencia-economica",
    tipo: "SOLVENCIA_ECONOMICA",
    descripcion: "Volumen anual de negocio ≥ 500.000 € en el último ejercicio",
    cita: "el volumen anual de negocios del licitador deberá alcanzar como mínimo el importe de 500.000 €",
    pliego: "PCAP",
    clausula: "5.1",
    pagina: 12,
    totalPaginas: 47,
    nivelCerteza: "ALTO",
    status: "green",
    highlightTop: 38,
  },
  {
    id: "solvencia-tecnica",
    tipo: "SOLVENCIA_TECNICA",
    descripcion: "Certificado ISO/IEC 27001 de seguridad de la información en vigor",
    cita: "los licitadores deberán estar en posesión del certificado ISO/IEC 27001, en vigor a la fecha de presentación",
    pliego: "PCAP",
    clausula: "5.3",
    pagina: 14,
    totalPaginas: 47,
    nivelCerteza: "ALTO",
    status: "red",
    highlightTop: 52,
  },
  {
    id: "habilitacion",
    tipo: "HABILITACION_EMPRESARIAL",
    descripcion: "Clasificación empresarial en el grupo III, subgrupo 3",
    cita: "se exigirá la clasificación en el grupo III, subgrupo 3, categoría 2, conforme al RGLCAP",
    pliego: "PCAP",
    clausula: "4.2",
    pagina: 9,
    totalPaginas: 47,
    nivelCerteza: "DUDOSO",
    status: "amber",
    highlightTop: 24,
  },
  {
    id: "prohibicion",
    tipo: "PROHIBICION_CONTRATAR",
    descripcion: "Declaración responsable de no estar incurso en prohibición de contratar",
    cita: "los licitadores presentarán declaración responsable conforme al modelo del Anexo II, no estando incursos en prohibición de contratar",
    pliego: "PCAP",
    clausula: "6",
    pagina: 16,
    totalPaginas: 47,
    nivelCerteza: "ALTO",
    status: "green",
    highlightTop: 45,
  },
];

const TIPO_LABELS: Record<PcapRequirementType, string> = {
  SOLVENCIA_ECONOMICA: "Solvencia económica",
  SOLVENCIA_TECNICA: "Solvencia técnica",
  HABILITACION_EMPRESARIAL: "Habilitación empresarial",
  PROHIBICION_CONTRATAR: "Prohibición de contratar",
};

const STATUS_STYLES = {
  green: { icon: CheckCircle2, label: "Cumples", classes: "bg-success/10 text-success border-success/30" },
  amber: { icon: AlertTriangle, label: "Revisar", classes: "bg-warning/10 text-warning border-warning/30" },
  red: { icon: XCircle, label: "No cumples", classes: "bg-destructive/10 text-destructive border-destructive/30" },
};

const CERTAINTY_LABELS: Record<NivelCerteza, string> = { ALTO: "Alta", DUDOSO: "Dudosa", AMBIGUO: "Ambigua" };

/** Líneas de relleno para simular el resto del texto de la página, con anchos variables para que no se vea uniforme. */
const FILLER_WIDTHS = [92, 88, 95, 64, 90, 85, 97, 78];

export function SolvencySplitDemo() {
  const [activeId, setActiveId] = useState(REQUIREMENTS[0].id);
  const active = REQUIREMENTS.find((r) => r.id === activeId) ?? REQUIREMENTS[0];

  return (
    <div className="grid gap-4 overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10 md:grid-cols-2">
      {/* Izquierda: semáforo de solvencia */}
      <div className="border-b p-4 md:border-b-0 md:border-r">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Semáforo de solvencia
        </p>
        <div className="space-y-2">
          {REQUIREMENTS.map((req) => {
            const style = STATUS_STYLES[req.status];
            const Icon = style.icon;
            const isActive = req.id === activeId;
            return (
              <button
                key={req.id}
                type="button"
                onClick={() => setActiveId(req.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all",
                  isActive ? cn(style.classes, "shadow-sm ring-1 ring-inset ring-current/20") : "border-transparent hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0", !isActive && "text-muted-foreground")} />
                  <span className="text-xs font-semibold">{TIPO_LABELS[req.tipo]}</span>
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                      isActive ? style.classes : "border-transparent text-muted-foreground"
                    )}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug">{req.descripcion}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {req.pliego} · pág. {req.pagina} · cláusula {req.clausula} · certeza {CERTAINTY_LABELS[req.nivelCerteza].toLowerCase()}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Derecha: página simulada del pliego, con el recuadro resaltado */}
      <div className="flex flex-col p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <FileSearch className="h-3.5 w-3.5" />
            {active.pliego} · página {active.pagina} de {active.totalPaginas}
          </span>
          <span>Cláusula {active.clausula}</span>
        </div>
        <div className="relative flex-1 rounded-lg border bg-background p-4 shadow-inner">
          <div className="mb-3 h-2.5 w-2/3 rounded bg-muted-foreground/20" />
          <div className="space-y-2">
            {FILLER_WIDTHS.map((width, i) => {
              const showHighlightHere = Math.abs(active.highlightTop - i * 12) < 6;
              if (showHighlightHere) {
                return (
                  <div
                    key={i}
                    className="animate-fade-in-up rounded-md border-2 border-warning bg-warning/20 px-2 py-1.5 text-xs italic text-foreground/80"
                  >
                    &ldquo;{active.cita}&rdquo;
                  </div>
                );
              }
              return <div key={i} className="h-2 rounded bg-muted-foreground/10" style={{ width: `${width}%` }} />;
            })}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Vista simulada para esta demo — en la app abre y resalta tu propio PDF real, cláusula exacta.
        </p>
      </div>
    </div>
  );
}
