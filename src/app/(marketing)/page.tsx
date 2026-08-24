import Link from "next/link";
import {
  CheckCircle2,
  FileSearch,
  Gauge,
  Building2,
  FileEdit,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG } from "@/lib/plans";

const steps = [
  {
    icon: FileSearch,
    title: "Sube el pliego",
    description: "Arrastra el PDF de la licitación pública o el RFP corporativo, aunque tenga 150 páginas.",
  },
  {
    icon: Gauge,
    title: "Semáforo de elegibilidad",
    description:
      "En minutos sabes qué requisitos excluyentes cumples, cuáles no y por qué — con la cita textual del pliego.",
  },
  {
    icon: Building2,
    title: "Perfil de empresa reutilizable",
    description: "Certificaciones, facturación y experiencia previa, rellenados una vez y cruzados en cada análisis.",
  },
  {
    icon: FileEdit,
    title: "Borrador de propuesta",
    description: "Índice generado según la estructura exigida por el pliego, exportable a Word y PDF.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="border-b bg-muted/30">
        <div className="container flex flex-col items-center gap-6 py-24 text-center">
          <Badge variant="outline" className="border-primary/30 text-primary">
            Para PYMEs, consultoras y despachos
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Deja de descartar licitaciones por pereza de leer 150 páginas
          </h1>
          <p className="max-w-2xl text-balance text-lg text-muted-foreground">
            RFPilot analiza pliegos de licitaciones públicas y RFPs corporativos, evalúa si tu empresa
            cumple los requisitos excluyentes y genera el borrador de tu propuesta técnica — todo en minutos.
          </p>
          <div className="flex gap-3">
            <Button size="lg" asChild>
              <Link href="/register">
                Empezar gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Cómo funciona</h2>
          <p className="mt-2 text-muted-foreground">De PDF a decisión de ir/no ir en menos de lo que tarda un café.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Card key={step.title} className="relative">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">
                  {i + 1}. {step.title}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Planes</h2>
            <p className="mt-2 text-muted-foreground">Empieza gratis. Crece de pay-as-you-go a marca blanca.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(Object.entries(PLAN_CONFIG) as [keyof typeof PLAN_CONFIG, (typeof PLAN_CONFIG)[keyof typeof PLAN_CONFIG]][]).map(
              ([key, plan]) => (
                <Card key={key} className={key === "PRO" ? "border-primary shadow-md" : undefined}>
                  <CardHeader>
                    {key === "PRO" && (
                      <Badge className="mb-2 w-fit">Más popular</Badge>
                    )}
                    <CardTitle>{plan.label}</CardTitle>
                    <p className="text-2xl font-semibold">{plan.priceLabel}</p>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Semáforo de elegibilidad automático
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Generador de borrador de propuesta
                      </li>
                      {key !== "PAY_AS_YOU_GO" && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          Alertas de nuevas licitaciones
                        </li>
                      )}
                      {key === "AGENCY" && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          Multi-cliente + marca blanca
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>
      </section>
    </>
  );
}
