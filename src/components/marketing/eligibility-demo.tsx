"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Vista previa animada del semáforo de elegibilidad, con los mismos
 * requisitos y umbrales que usa el pliego de demo del seed
 * (prisma/fixtures/mock-tender-content.ts) — no son cifras inventadas
 * para la landing, son un ejemplo real del producto.
 */
const EXAMPLES = [
  {
    requirement: "Certificado ISO 9001:2015 vigente",
    citation: "Pliego, cláusula 7.2 — solvencia técnica",
    status: "green" as const,
  },
  {
    requirement: "Facturación mínima de 480.000 € en 3 años",
    citation: "Pliego, cláusula 7.4 — solvencia económica",
    status: "amber" as const,
  },
  {
    requirement: "Certificado ISO/IEC 27001 vigente",
    citation: "Pliego, cláusula 7.3 — seguridad de la información",
    status: "red" as const,
  },
];

const STATUS_STYLES = {
  green: { icon: CheckCircle2, label: "Cumples", classes: "bg-success/10 text-success border-success/30" },
  amber: { icon: AlertTriangle, label: "Revisar", classes: "bg-warning/10 text-warning border-warning/30" },
  red: { icon: XCircle, label: "No cumples", classes: "bg-destructive/10 text-destructive border-destructive/30" },
};

const DOT_COLOR = { green: "bg-success", amber: "bg-warning", red: "bg-destructive" };

export function EligibilityDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card/95 p-5 shadow-2xl shadow-primary/10 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            Mantenimiento de sistemas — Ayto. Villaverde de la Sierra
          </p>
          <p className="text-sm font-semibold">Semáforo de elegibilidad</p>
        </div>
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-500",
            DOT_COLOR[EXAMPLES[active].status],
            "animate-pulse"
          )}
        />
      </div>
      <div className="space-y-2">
        {EXAMPLES.map((example, i) => {
          const style = STATUS_STYLES[example.status];
          const Icon = style.icon;
          const isActive = i === active;
          return (
            <div
              key={example.requirement}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-all duration-500 ease-out",
                isActive ? cn(style.classes, "scale-[1.02] shadow-sm") : "border-transparent opacity-45"
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", !isActive && "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{example.requirement}</p>
                <p className="truncate text-xs text-muted-foreground">{example.citation}</p>
              </div>
              {isActive && (
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    style.classes
                  )}
                >
                  {style.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
