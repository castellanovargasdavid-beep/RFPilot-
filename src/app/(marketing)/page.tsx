import Link from "next/link";
import {
  CheckCircle2,
  FileSearch,
  Gauge,
  Building2,
  FileEdit,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Scale,
  Table2,
  FolderCheck,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG } from "@/lib/plans";
import { Reveal } from "@/components/marketing/reveal";
import { StatCounter } from "@/components/marketing/stat-counter";
import { SolvencySplitDemo } from "@/components/marketing/solvency-split-demo";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: FileSearch,
    title: "Sube el PCAP y el PPT",
    description: "Arrastra el PDF descargado de la PLACSP — pliego administrativo, técnico o combinado, hasta 150 páginas.",
    color: "text-brand-blue bg-brand-blue/10",
  },
  {
    icon: Scale,
    title: "Análisis especializado",
    description: "Dos procesos de IA distintos: uno para solvencia y habilitación (PCAP), otro para baremo y técnica (PPT).",
    color: "text-brand-rose bg-brand-rose/10",
  },
  {
    icon: Gauge,
    title: "Semáforo auditable",
    description: "Cada requisito con su cita verificada automáticamente contra el texto real del pliego — clic y ves la cláusula exacta.",
    color: "text-brand-teal bg-brand-teal/10",
  },
  {
    icon: FileEdit,
    title: "Borrador y DEUC",
    description: "Índice según el Anexo I del pliego, exportable a Word y PDF, con tu perfil de solvencia ya cruzado.",
    color: "text-brand-amber bg-brand-amber/10",
  },
];

const features = [
  {
    icon: Scale,
    color: "text-brand-blue bg-brand-blue/10",
    title: "Especialización PCAP vs. PPT",
    description:
      "Un proceso de IA distinto para cada pliego, igual que lo haría un jurista y un técnico revisando cada uno su parte — no una IA genérica leyéndolo todo de un vistazo.",
    bullets: [
      "Solvencia, habilitación y prohibiciones de contratar (PCAP)",
      "Criterios de adjudicación, SLAs y técnica (PPT)",
      "Cada cita etiquetada con el pliego exacto de origen",
    ],
  },
  {
    icon: Table2,
    color: "text-brand-rose bg-brand-rose/10",
    title: "Matriz de criterios de ponderación",
    description:
      "Distingue automáticamente los criterios evaluables por fórmula matemática de los que dependen de un juicio de valor — para saber dónde tu memoria técnica realmente puede marcar la diferencia.",
    bullets: [
      "Peso porcentual y puntuación máxima de cada criterio",
      "Marcado como fórmula objetiva o juicio de valor",
      "Cita literal de la cláusula del baremo",
    ],
  },
  {
    icon: FolderCheck,
    color: "text-brand-teal bg-brand-teal/10",
    title: "Gestor de solvencia y DEUC",
    description:
      "Certificaciones, facturación, referencias y equipo técnico rellenados una vez y cruzados contra cada pliego — la base para completar tu Documento Europeo Único de Contratación sin repetir datos licitación tras licitación.",
    bullets: [
      "Alertas de caducidad de certificaciones antes de presentar oferta",
      "Cruce automático contra los requisitos de solvencia de cada PCAP",
      "Datos listos para tu declaración responsable / DEUC",
    ],
  },
  {
    icon: Target,
    color: "text-brand-amber bg-brand-amber/10",
    title: "Simulador de puntuación técnica",
    description:
      "A partir del baremo extraído del PPT, estima qué puntuación técnica podría alcanzar tu propuesta según el enfoque planteado — para decidir si merece la pena competir antes de redactar la memoria completa.",
    bullets: [
      "Basado en los pesos reales del baremo del pliego",
      "Compara escenarios antes de escribir la memoria técnica",
      "Decide ir/no ir con datos, no con intuición",
    ],
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

        <div className="container relative flex flex-col items-center gap-6 py-20 text-center lg:py-28">
          <div className="animate-fade-in-up flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
              <Scale className="h-3.5 w-3.5" />
              Conforme a la LCSP
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/5 text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% auditable — cada dato con su cita exacta
            </Badge>
          </div>
          <h1
            className="animate-fade-in-up max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            Analiza pliegos de la PLACSP con el rigor de un{" "}
            <span className="animate-gradient-x bg-gradient-to-r from-primary via-brand-violet to-brand-rose bg-clip-text text-transparent">
              jurista de contratación
            </span>
          </h1>
          <p className="animate-fade-in-up max-w-2xl text-balance text-lg text-muted-foreground" style={{ animationDelay: "160ms" }}>
            RFPilot separa PCAP y PPT, verifica cada cita contra el texto real del pliego y te dice con precisión
            legal si tu empresa cumple los requisitos de solvencia — sin alucinaciones, con página y cláusula exacta.
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
        <Reveal className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Así es tu semáforo de solvencia</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Cada requisito lleva su cita literal, la cláusula y la página exacta del pliego. Haz clic en cualquiera
            para ver dónde aparece — en la app real, sobre tu propio PDF.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <SolvencySplitDemo />
        </Reveal>
      </section>

      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <Reveal className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Todo lo que exige una licitación pública</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Más allá del semáforo: las herramientas específicas para competir por contratos del sector público.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 100}>
                <Card className="h-full transition-all hover:-translate-y-1 hover:shadow-lg">
                  <CardHeader>
                    <div className={cn("mb-2 flex h-10 w-10 items-center justify-center rounded-lg", feature.color)}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {feature.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
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
                          Semáforo de solvencia auditable (PCAP + PPT)
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
                  ¿Tienes un expediente de la PLACSP abierto ahora mismo?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-balance text-primary-foreground/90">
                  Sube el PCAP y el PPT y en minutos sabrás si tu solvencia encaja — con cada cláusula citada y
                  verificada, no adivinada.
                </p>
                <Button size="lg" variant="secondary" className="mt-6" asChild>
                  <Link href="/register">
                    Analizar mi pliego de la PLACSP <ArrowRight className="h-4 w-4" />
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
