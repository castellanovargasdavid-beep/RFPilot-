import Link from "next/link";
import {
  CheckCircle2,
  FileSearch,
  Gauge,
  Building2,
  FileEdit,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG } from "@/lib/plans";
import { Reveal } from "@/components/marketing/reveal";
import { StatCounter } from "@/components/marketing/stat-counter";
import { EligibilityDemo } from "@/components/marketing/eligibility-demo";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: FileSearch,
    title: "Sube el pliego",
    description: "Arrastra el PDF de la licitación pública o el RFP corporativo, aunque tenga 150 páginas.",
    color: "text-brand-blue bg-brand-blue/10",
  },
  {
    icon: Gauge,
    title: "Semáforo de elegibilidad",
    description:
      "En minutos sabes qué requisitos excluyentes cumples, cuáles no y por qué — con la cita textual del pliego.",
    color: "text-brand-rose bg-brand-rose/10",
  },
  {
    icon: Building2,
    title: "Perfil de empresa reutilizable",
    description: "Certificaciones, facturación y experiencia previa, rellenados una vez y cruzados en cada análisis.",
    color: "text-brand-teal bg-brand-teal/10",
  },
  {
    icon: FileEdit,
    title: "Borrador de propuesta",
    description: "Índice generado según la estructura exigida por el pliego, exportable a Word y PDF.",
    color: "text-brand-amber bg-brand-amber/10",
  },
];

const stats = [
  { value: 150, suffix: "", label: "páginas de pliego analizadas de una sola vez, sin recortes" },
  { value: 4, suffix: "", label: "pasos: subir, semáforo, perfil de empresa y borrador" },
  { value: 100, suffix: "%", label: "de los requisitos, con cita literal y página o cláusula" },
];

const PLAN_ACCENT: Record<string, string> = {
  PAY_AS_YOU_GO: "bg-brand-teal",
  PRO: "bg-primary",
  AGENCY: "bg-brand-violet",
};

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/40 via-background to-background">
        <div
          aria-hidden
          className="animate-blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-violet/25 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-blob animation-delay-2000 absolute -right-16 top-10 h-80 w-80 rounded-full bg-brand-blue/20 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-blob animation-delay-4000 absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand-teal/20 blur-3xl"
        />

        <div className="container relative grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className="flex flex-col items-start gap-6 text-left">
            <Badge
              variant="outline"
              className="animate-fade-in-up gap-1.5 border-primary/30 bg-primary/5 text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Para PYMEs, consultoras y despachos
            </Badge>
            <h1
              className="animate-fade-in-up text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
              style={{ animationDelay: "80ms" }}
            >
              Deja de descartar licitaciones por pereza de leer{" "}
              <span className="animate-gradient-x bg-gradient-to-r from-primary via-brand-violet to-brand-rose bg-clip-text text-transparent">
                150 páginas
              </span>
            </h1>
            <p className="animate-fade-in-up max-w-xl text-balance text-lg text-muted-foreground" style={{ animationDelay: "160ms" }}>
              RFPilot analiza pliegos de licitaciones públicas y RFPs corporativos, evalúa si tu empresa
              cumple los requisitos excluyentes y genera el borrador de tu propuesta técnica — todo en minutos.
            </p>
            <div className="animate-fade-in-up flex gap-3" style={{ animationDelay: "240ms" }}>
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

          <div className="flex animate-fade-in-up justify-center lg:justify-end" style={{ animationDelay: "200ms" }}>
            <EligibilityDemo />
          </div>
        </div>
      </section>

      <section className="border-b bg-card py-10">
        <div className="container grid gap-8 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100} className="text-center sm:text-left">
              <p className="text-3xl font-semibold tracking-tight text-primary">
                <StatCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container py-20">
        <Reveal className="mb-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Cómo funciona</h2>
          <p className="mt-2 text-muted-foreground">De PDF a decisión de ir/no ir en menos de lo que tarda un café.</p>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <Card className="relative h-full transition-all hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <div className={cn("mb-2 flex h-10 w-10 items-center justify-center rounded-lg", step.color)}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">
                    {i + 1}. {step.title}
                  </CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <Reveal className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Planes</h2>
            <p className="mt-2 text-muted-foreground">Empieza gratis. Crece de pay-as-you-go a marca blanca.</p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {(Object.entries(PLAN_CONFIG) as [keyof typeof PLAN_CONFIG, (typeof PLAN_CONFIG)[keyof typeof PLAN_CONFIG]][]).map(
              ([key, plan], i) => (
                <Reveal key={key} delay={i * 120}>
                  <Card
                    className={cn(
                      "relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg",
                      key === "PRO" && "border-primary shadow-md"
                    )}
                  >
                    <div className={cn("absolute inset-x-0 top-0 h-1.5", PLAN_ACCENT[key])} />
                    <CardHeader>
                      {key === "PRO" && <Badge className="mb-2 w-fit">Más popular</Badge>}
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
                </Reveal>
              )
            )}
          </div>
        </div>
      </section>

      <section className="border-t py-20">
        <div className="container">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-brand-violet px-8 py-14 text-center text-primary-foreground shadow-xl">
              <div aria-hidden className="animate-blob absolute -left-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div
                aria-hidden
                className="animate-blob animation-delay-2000 absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-white/10 blur-3xl"
              />
              <div className="relative">
                <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                  ¿Tienes un pliego encima de la mesa ahora mismo?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-balance text-primary-foreground/90">
                  Súbelo y en minutos sabrás si merece la pena presentarse — sin leer las 150 páginas tú primero.
                </p>
                <Button size="lg" variant="secondary" className="mt-6" asChild>
                  <Link href="/register">
                    Analizar mi primer pliego <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
