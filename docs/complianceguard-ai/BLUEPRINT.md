# ComplianceGuard AI (alias LexiShield) — Blueprint técnico y de producto

> Documento de diseño completo para un SaaS B2B nuevo: auditoría de privacidad
> en 1 clic (RGPD/GDPR, CCPA/CPRA, ePrivacy) + generación automática de
> documentación legal con Claude. No es una funcionalidad de RFPilot — es un
> producto independiente que reutiliza el mismo stack ya probado en este repo
> (Next.js 14 App Router, TypeScript, Prisma/PostgreSQL, Inngest, Stripe,
> Anthropic SDK, shadcn/ui) porque el shape del problema es el mismo: subir/
> escanear un input pesado → pipeline async de IA → informe estructurado +
> documento generado → paywall. Este documento es autocontenido: si se decide
> construirlo, es el punto de partida para un repo nuevo (o un monorepo
> hermano), no un parche sobre el dominio de licitaciones de RFPilot.

## Índice

1. [Arquitectura del escáner (crawler)](#1-arquitectura-del-escáner-crawler)
2. [System prompts de producción para Claude](#2-system-prompts-de-producción-para-claude)
3. [Base de datos y API endpoints](#3-base-de-datos-y-api-endpoints)
4. [UX y onboarding de alta conversión](#4-ux-y-onboarding-de-alta-conversión)
5. [Mitigación de riesgo legal del propio SaaS](#5-mitigación-de-riesgo-legal-del-propio-saas)

---

## 1. Arquitectura del escáner (crawler)

### 1.1 Por qué Puppeteer + Cheerio combinados, y por qué en dos pasadas

Un escáner de cumplimiento que solo lee el HTML servido por el origen
(Cheerio/`fetch` puro) es ciego a todo lo que carga después de la
hidratación: la mayoría de los trackers reales (Meta Pixel, GA4, Hotjar,
TikTok Pixel) se inyectan vía JavaScript, no vienen en el HTML inicial. Por
eso el crawler necesita un navegador real (Puppeteer/Chromium headless) para
observar tráfico de red y `document.cookie` tal como los vería un usuario de
verdad.

**La infracción más común y más grave en RGPD/ePrivacy es setear cookies de
tracking *antes* de obtener consentimiento.** Por eso el escaneo se hace en
**dos pasadas**, no una:

1. **Pasada A — "pre-consentimiento"**: se navega a la URL con las cookies
   limpias (contexto de navegador nuevo) y **sin interactuar con el banner
   de cookies**. Se capturan todas las peticiones de red y cookies seteadas
   en los primeros ~5s + hasta que la página esté "networkidle". Esto es lo
   que ve un usuario que todavía no ha decidido nada — si aquí ya hay
   cookies de `_ga`, `_fbp`, etc., es una infracción de libro.
2. **Pasada B — "post-aceptación"**: en un contexto de navegador limpio
   nuevo, se detecta el banner de consentimiento (ver 1.4) y se simula un
   clic en "Aceptar todo" (o el CMP correspondiente vía su API JS si expone
   una, p.ej. `window.Cookiebot.submitCustomConsent(...)` / `__tcfapi`).
   Se capturan de nuevo cookies + peticiones. La diferencia entre A y B es
   la señal más valiosa: cookies que aparecen en A no deberían existir; si
   tras "aceptar" en B no aparecen cookies *nuevas* de trackers ya
   detectados en el HTML/scripts, el banner probablemente no está
   bloqueando la carga de scripts (otro fallo común: el CMP existe mas no
   está *conectado* a los scripts).

Cheerio entra en un tercer sub-paso, mucho más barato: una vez Puppeteer
devuelve el HTML final renderizado (y el de las páginas legales enlazadas),
se usa Cheerio (parseo DOM sin motor JS) para extraer texto plano de forma
barata — política de privacidad actual, cookies, T&C, formularios — sin
pagar el coste de otro navegador headless por cada página secundaria.

### 1.2 Pipeline paso a paso

```
                     ┌─────────────────────────────┐
                     │ POST /api/scan { url }       │
                     │ valida URL, rate-limit,      │
                     │ descuenta crédito/free-scan  │
                     └──────────────┬───────────────┘
                                    │ evento Inngest: "scan/requested"
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Inngest function: runComplianceScan (steps durables, reintentos)       │
│                                                                         │
│ 1. resolveTargetPages(url)                                             │
│    - normaliza URL, valida robots.txt (no ignorarlo)                   │
│    - homepage + hasta N=5 páginas: enlaces del footer que contengan    │
│      keywords legales (privacidad, cookies, términos, legal, aviso)    │
│      + una página con formulario si se detecta (contacto/checkout)     │
│                                                                         │
│ 2. crawlPagePrePostConsent(page) — por cada página objetivo            │
│    a. Pasada A (pre-consentimiento): launchBrowserContext()            │
│       - page.setRequestInterception(true)                              │
│       - captura requests salientes (dominio, tipo de recurso)          │
│       - captura Set-Cookie de response headers                         │
│       - tras networkidle2: page.evaluate(() => document.cookie)        │
│       - captura page.frames() (iframes) y sus src                      │
│    b. detectCmp(page) — heurística (ver 1.4)                           │
│    c. Pasada B (post-aceptación): nuevo contexto limpio                │
│       - si hay CMP conocido: click en selector de "aceptar todo"       │
│         (mapa de selectores por proveedor) o llamada a su API JS       │
│       - si CMP desconocido: intento genérico por texto de botón        │
│         ("aceptar", "accept all", "aceptar todo", "entendido")         │
│       - repite la misma captura de red/cookies que en (a)              │
│    d. extractScriptsAndPixels(page) — dedupe de <script src> +         │
│       inline scripts que matchean firmas conocidas (ver 1.3)           │
│    e. extractForms(page) — inputs, tipos, atributo required,           │
│       checkbox de consentimiento presente/ausente junto al submit      │
│                                                                         │
│ 3. fetchAndParseLegalPages(links) — Cheerio, texto plano de política   │
│    de privacidad/cookies/T&C actuales si existen (para que Claude      │
│    audite el texto real contra lo detectado técnicamente)              │
│                                                                         │
│ 4. buildIntermediatePayload(...) — arma el JSON (ver 1.5)              │
│                                                                         │
│ 5. persistScan(payload) — guarda en `scans` + dispara evento           │
│    "scan/technical-payload.ready"                                      │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                     (Fase de IA — ver sección 2:
                      Prompt 1 audita, Prompt 2 genera documentos
                      bajo demanda tras el paywall)
```

Igual que en el pipeline de análisis de RFPilot, esto **no puede vivir en
una función serverless síncrona**: lanzar dos navegadores headless +
esperar `networkidle` en varias páginas fácilmente supera los 10-60s que
permite una request HTTP normal en Vercel. Se orquesta con **Inngest**
(mismo patrón que `src/ai/analyze-tender.ts` en RFPilot: steps durables,
reintentos automáticos por step, estado consultable en tiempo real desde la
UI vía polling/websocket).

Para Puppeteer en Vercel (serverless, sin Chromium del sistema) se usa
`puppeteer-core` + `@sparticuz/chromium` (binario de Chromium empaquetado
para Lambda/Vercel, sin depender de librerías nativas del host) — el mismo
tipo de decisión que RFPilot tomó con `@napi-rs/canvas` para evitar
dependencias nativas frágiles en serverless.

### 1.3 Base de firmas de terceros (fingerprinting)

```ts
// src/scanner/trackers-db.ts

export type TrackerCategory =
  | "analytics"
  | "advertising"
  | "session_recording"
  | "payments"
  | "cdn_embed"
  | "chat_support"
  | "cmp";

export interface TrackerSignature {
  id: string;
  name: string;
  category: TrackerCategory;
  /** Dominios en <script src> o en requests de red que identifican la herramienta */
  domainPatterns: RegExp[];
  /** Fragmentos que identifican un snippet inline (gtag(...), fbq(...), etc.) */
  inlinePatterns?: RegExp[];
  /** Regulaciones típicamente relevantes para esta categoría de herramienta */
  relevantRegulations: Array<"GDPR" | "ePrivacy" | "CCPA" | "CPRA">;
  /** Si la herramienta transfiere datos a EE. UU. por defecto (relevante para el art. 44+ RGPD) */
  usDataTransfer: boolean;
  /** Duración típica documentada por el proveedor, usada como fallback en la política de cookies */
  typicalCookieDurations?: Record<string, string>;
}

export const TRACKER_SIGNATURES: TrackerSignature[] = [
  {
    id: "google_analytics_4",
    name: "Google Analytics 4",
    category: "analytics",
    domainPatterns: [/googletagmanager\.com\/gtag\/js/, /google-analytics\.com\/g\/collect/],
    inlinePatterns: [/gtag\(\s*['"]config['"]/, /G-[A-Z0-9]{6,}/],
    relevantRegulations: ["GDPR", "ePrivacy", "CCPA", "CPRA"],
    usDataTransfer: true,
    typicalCookieDurations: { _ga: "2 años", _ga_XXXXXXX: "2 años", _gid: "24 horas" },
  },
  {
    id: "meta_pixel",
    name: "Meta Pixel (Facebook/Instagram Ads)",
    category: "advertising",
    domainPatterns: [/connect\.facebook\.net\/.+\/fbevents\.js/],
    inlinePatterns: [/fbq\(\s*['"]init['"]/],
    relevantRegulations: ["GDPR", "ePrivacy", "CCPA", "CPRA"],
    usDataTransfer: true,
    typicalCookieDurations: { _fbp: "3 meses", _fbc: "3 meses" },
  },
  {
    id: "tiktok_pixel",
    name: "TikTok Pixel",
    category: "advertising",
    domainPatterns: [/analytics\.tiktok\.com/],
    inlinePatterns: [/ttq\.load\(/],
    relevantRegulations: ["GDPR", "ePrivacy", "CCPA", "CPRA"],
    usDataTransfer: true,
  },
  {
    id: "hotjar",
    name: "Hotjar",
    category: "session_recording",
    domainPatterns: [/static\.hotjar\.com/, /script\.hotjar\.com/],
    inlinePatterns: [/hjid\s*[:=]/],
    relevantRegulations: ["GDPR", "ePrivacy"],
    usDataTransfer: false,
    typicalCookieDurations: { _hjSessionUser_XXXXX: "1 año" },
  },
  {
    id: "microsoft_clarity",
    name: "Microsoft Clarity",
    category: "session_recording",
    domainPatterns: [/clarity\.ms/],
    relevantRegulations: ["GDPR", "ePrivacy"],
    usDataTransfer: true,
  },
  {
    id: "stripe_js",
    name: "Stripe",
    category: "payments",
    domainPatterns: [/js\.stripe\.com/],
    relevantRegulations: ["GDPR", "CCPA"],
    usDataTransfer: true,
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "chat_support",
    domainPatterns: [/widget\.intercom\.io/, /js\.intercomcdn\.com/],
    relevantRegulations: ["GDPR", "ePrivacy", "CCPA"],
    usDataTransfer: true,
  },
  {
    id: "youtube_embed",
    name: "YouTube (iframe embed)",
    category: "cdn_embed",
    domainPatterns: [/youtube\.com\/embed/, /youtube-nocookie\.com/],
    relevantRegulations: ["GDPR", "ePrivacy"],
    usDataTransfer: true,
  },
  {
    id: "google_maps_embed",
    name: "Google Maps (iframe embed)",
    category: "cdn_embed",
    domainPatterns: [/google\.com\/maps\/embed/],
    relevantRegulations: ["GDPR"],
    usDataTransfer: true,
  },
  // CMPs conocidos — se detectan para (a) saber si hay banner y (b) mapear
  // su selector de "aceptar todo" en la pasada B.
  {
    id: "cookiebot",
    name: "Cookiebot",
    category: "cmp",
    domainPatterns: [/consent\.cookiebot\.com/],
    relevantRegulations: ["GDPR", "ePrivacy"],
    usDataTransfer: false,
  },
  {
    id: "onetrust",
    name: "OneTrust",
    category: "cmp",
    domainPatterns: [/cdn\.cookielaw\.org/, /onetrust\.com/],
    relevantRegulations: ["GDPR", "ePrivacy", "CCPA", "CPRA"],
    usDataTransfer: false,
  },
  {
    id: "termly",
    name: "Termly CMP",
    category: "cmp",
    domainPatterns: [/app\.termly\.io/],
    relevantRegulations: ["GDPR", "ePrivacy", "CCPA"],
    usDataTransfer: false,
  },
];

export function matchTrackers(
  scriptSrcs: string[],
  inlineScriptContents: string[],
): TrackerSignature[] {
  const matched = new Set<TrackerSignature>();
  for (const sig of TRACKER_SIGNATURES) {
    const domainHit = scriptSrcs.some((src) => sig.domainPatterns.some((re) => re.test(src)));
    const inlineHit =
      sig.inlinePatterns?.some((re) => inlineScriptContents.some((code) => re.test(code))) ?? false;
    if (domainHit || inlineHit) matched.add(sig);
  }
  return [...matched];
}
```

Esta base es intencionadamente **extensible por config, no por código**
nuevo cada vez: en producción viviría en una tabla `tracker_signatures` en
vez de un array hardcodeado, para poder añadir firmas sin desplegar. El
array de arriba es el seed inicial (v0), suficiente para cubrir el 90% de
lo que trae una PYME media (GA4, Meta Pixel, algún chat, Stripe, embeds de
YouTube/Maps).

### 1.4 Detección de banners CMP

Heurística en cascada, de más a menos fiable:

```ts
// src/scanner/cmp-detector.ts
import type { Page } from "puppeteer-core";

export interface CmpDetectionResult {
  present: boolean;
  provider: string | null; // id de TRACKER_SIGNATURES categoría "cmp", o "custom"
  usesIabTcf: boolean; // expone window.__tcfapi (IAB Transparency & Consent Framework)
  acceptAllClicked: boolean;
  rejectOptionVisible: boolean; // RGPD exige que rechazar sea tan fácil como aceptar
}

const KNOWN_ACCEPT_SELECTORS: Record<string, string> = {
  cookiebot: "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  onetrust: "#onetrust-accept-btn-handler",
  termly: ".t-acceptAllButton",
};

const GENERIC_ACCEPT_TEXT = [
  "aceptar todo", "aceptar todas", "accept all", "aceptar", "entendido",
  "allow all", "i accept", "de acuerdo",
];

const GENERIC_REJECT_TEXT = [
  "rechazar todo", "rechazar todas", "reject all", "solo necesarias",
  "necessary only", "decline",
];

export async function detectAndAcceptCmp(page: Page): Promise<CmpDetectionResult> {
  const usesIabTcf = await page.evaluate(() => typeof (window as any).__tcfapi === "function");

  const knownProvider = await page.evaluate(() => {
    if ((window as any).Cookiebot) return "cookiebot";
    if ((window as any).OneTrust) return "onetrust";
    if ((window as any).Termly) return "termly";
    return null;
  });

  let acceptAllClicked = false;
  let rejectOptionVisible = false;

  if (knownProvider && KNOWN_ACCEPT_SELECTORS[knownProvider]) {
    const el = await page.$(KNOWN_ACCEPT_SELECTORS[knownProvider]);
    if (el) {
      await el.click();
      acceptAllClicked = true;
    }
  }

  if (!acceptAllClicked) {
    // Fallback genérico: busca cualquier botón/enlace visible cuyo texto
    // matchee una frase de aceptación conocida.
    acceptAllClicked = await clickByVisibleText(page, GENERIC_ACCEPT_TEXT);
  }

  rejectOptionVisible = await elementWithTextExists(page, GENERIC_REJECT_TEXT);

  return {
    present: Boolean(knownProvider) || acceptAllClicked || usesIabTcf,
    provider: knownProvider,
    usesIabTcf,
    acceptAllClicked,
    rejectOptionVisible,
  };
}

async function clickByVisibleText(page: Page, phrases: string[]): Promise<boolean> {
  return page.evaluate((needles: string[]) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
    const target = candidates.find((el) => {
      const text = (el.innerText || "").trim().toLowerCase();
      return text.length < 40 && needles.some((n) => text.includes(n));
    });
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, phrases);
}

async function elementWithTextExists(page: Page, phrases: string[]): Promise<boolean> {
  return page.evaluate((needles: string[]) => {
    const all = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
    return all.some((el) => {
      const text = (el.innerText || "").trim().toLowerCase();
      return text.length < 40 && needles.some((n) => text.includes(n));
    });
  }, phrases);
}
```

`rejectOptionVisible: false` cuando sí hay un CMP con "aceptar" pero no un
"rechazar" igual de accesible (patrón oscuro habitual, "cookie wall"/dark
pattern) es en sí mismo una señal de infracción que se pasa a Claude —
**no se descarta, se envía tal cual al Prompt 1** para que lo puntúe.

### 1.5 JSON intermedio (payload para Claude)

Este es el contrato entre el crawler y la capa de IA — estable y versionado
(`schemaVersion`) para poder evolucionar el crawler sin romper los prompts
ya en producción.

```ts
// src/scanner/types.ts

export interface TechnicalAuditPayload {
  schemaVersion: "1.0";
  scanId: string;
  scannedAt: string; // ISO 8601
  targetUrl: string;
  pagesScanned: Array<{ url: string; role: "homepage" | "legal_page" | "form_page" }>;

  consent: {
    cmp: {
      present: boolean;
      provider: string | null;
      usesIabTcf: boolean;
      rejectAsEasyAsAccept: boolean;
    };
    // La comparación pre/post consentimiento es el corazón del audit técnico.
    prePassCookies: CookieRecord[];
    postPassCookies: CookieRecord[];
    // Cookies presentes en prePassCookies que NO son estrictamente necesarias
    // (no session/csrf/carrito) -> infracción directa si no hay excepción.
    cookiesSetBeforeConsent: CookieRecord[];
  };

  trackersDetected: Array<{
    id: string;
    name: string;
    category: string;
    relevantRegulations: string[];
    usDataTransfer: boolean;
    detectedVia: "network_domain" | "inline_script" | "iframe";
    loadedBeforeConsent: boolean;
  }>;

  iframes: Array<{ src: string; loadedBeforeConsent: boolean }>;

  forms: Array<{
    pageUrl: string;
    purpose: "contact" | "newsletter" | "checkout" | "account_signup" | "unknown";
    collectsPersonalData: boolean; // heurística: input email/tel/nombre/dirección
    fields: string[]; // nombres/tipos de input detectados
    hasConsentCheckbox: boolean;
    hasPrivacyPolicyLink: boolean;
    checkboxPreChecked: boolean; // pre-marcado = infracción (consentimiento no es "libre" ni "inequívoco")
  }>;

  existingLegalPages: {
    privacyPolicy: { found: boolean; url: string | null; extractedText: string | null };
    cookiePolicy: { found: boolean; url: string | null; extractedText: string | null };
    termsAndConditions: { found: boolean; url: string | null; extractedText: string | null };
  };

  businessContext: {
    // Rellenado por el usuario en el formulario previo al escaneo (no inferido) —
    // necesario para que Claude sepa qué normativa aplicar y con qué identidad legal.
    companyName: string | null;
    countryOfEstablishment: string | null;
    targetsEuUsers: boolean;
    targetsCaliforniaUsers: boolean;
    sellsOnline: boolean;
    hasEmployeesOrHr: boolean; // afecta si aplica también tratamiento de datos de RRHH
  };
}

export interface CookieRecord {
  name: string;
  domain: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  expiresInDays: number | null; // null = cookie de sesión
  setBy: "first_party" | "third_party";
}
```

`businessContext` es el único bloque que **no** sale del crawler —
sale de un formulario corto de 4-5 preguntas que el usuario responde antes
de lanzar el escaneo (ver sección 4). Sin esto, Claude estaría adivinando
jurisdicción aplicable, que es precisamente lo que no debe adivinar.

---

## 2. System prompts de producción para Claude

Ambos prompts usan **structured outputs** del SDK de Anthropic
(`output_config.format` + `zodOutputFormat(schema)`, igual que el patrón ya
validado en `src/ai/analyze-tender.ts` de RFPilot) para el Prompt 1 (JSON
validado), y generación de texto libre para el Prompt 2 (Markdown). Modelo
recomendado: `claude-opus-5` para el Prompt 1 (es el análisis legal crítico
— un falso "cumples" aquí expone al cliente a una multa real), y
`claude-sonnet-5` es aceptable para el Prompt 2 (redacción de documentos,
menos crítico en términos de razonamiento, mejor coste/latencia); si el
presupuesto lo permite, Opus también en el Prompt 2 para máxima calidad de
redacción legal.

### 2.1 Prompt 1 — Auditor y semáforo de riesgo

```ts
// src/ai/schemas/audit-report.schema.ts
import { z } from "zod/v4";

export const ViolationSeverity = z.enum(["ALTA", "MEDIA", "BAJA"]);

export const ViolationSchema = z.object({
  id: z.string().describe("slug único, p.ej. 'cookies-pre-consentimiento-ga4'"),
  severity: ViolationSeverity,
  category: z.enum([
    "CONSENTIMIENTO_COOKIES",
    "TRANSFERENCIA_INTERNACIONAL",
    "BASE_LEGAL_TRATAMIENTO",
    "DERECHOS_USUARIO",
    "TRANSPARENCIA_POLITICA",
    "FORMULARIOS_RECOGIDA_DATOS",
    "PATRON_OSCURO_DARK_PATTERN",
    "MENORES",
    "SEGURIDAD_DATOS",
  ]),
  regulationsViolated: z.array(z.enum(["RGPD", "ePrivacy", "CCPA", "CPRA"])),
  articlesReferenced: z.array(z.string()).describe(
    "artículos concretos, p.ej. ['RGPD art. 6', 'RGPD art. 7.3', 'LSSI-CE art. 22.2']",
  ),
  evidence: z.string().describe(
    "evidencia técnica concreta extraída del payload que sustenta el hallazgo, " +
    "citando el dato exacto (nombre de cookie, dominio, script) — nunca genérica",
  ),
  legalJustification: z.string().describe(
    "1-3 frases explicando por qué esto es una infracción bajo la normativa citada, " +
    "en lenguaje claro para un no-abogado",
  ),
  recommendedFix: z.string().describe("acción concreta y accionable para corregirlo"),
});

export const AuditReportSchema = z.object({
  riskScore: z.number().int().min(0).max(100).describe(
    "0 = sin riesgo detectable, 100 = riesgo crítico. Ponderado por severidad " +
    "y número de infracciones ALTA, no un promedio simple",
  ),
  riskLevel: z.enum(["VERDE", "AMBAR", "ROJO"]).describe(
    "VERDE: riskScore 0-24 y cero infracciones ALTA. " +
    "AMBAR: riskScore 25-59, o cualquier infracción ALTA aislada sin patrón sistemático. " +
    "ROJO: riskScore 60-100, o 2+ infracciones ALTA, o cualquier patrón oscuro confirmado.",
  ),
  applicableRegulations: z.array(z.enum(["RGPD", "ePrivacy", "CCPA", "CPRA"])).describe(
    "solo las que aplican según businessContext — nunca listar CCPA si no hay señal " +
    "de usuarios de California, nunca listar RGPD si no hay señal de usuarios UE",
  ),
  violations: z.array(ViolationSchema),
  executiveSummary: z.string().describe(
    "3-5 frases en lenguaje llano dirigidas al dueño de una PYME sin formación legal: " +
    "qué se encontró, por qué importa, y la urgencia relativa",
  ),
  requirementsSectionUnclear: z.boolean().describe(
    "true si existingLegalPages no contiene texto suficiente para auditar la política " +
    "actual (no confundir con 'no hay política' — eso es una violation ALTA en sí misma)",
  ),
});
```

```text
# system prompt — Prompt 1: Auditor de Cumplimiento y Semáforo de Riesgo

Eres un auditor experto en privacidad digital y protección de datos,
especializado en RGPD (Reglamento UE 2016/679), la Directiva ePrivacy
(y su transposición en LSSI-CE cuando el contexto sea España), CCPA y
CPRA de California. Tu trabajo es auditar la evidencia TÉCNICA recopilada
por un escáner automatizado de un sitio web y el texto de su documentación
legal actual (si existe), y devolver un veredicto estructurado.

## Reglas de oro (nunca las rompas)

1. **Solo audita lo que está en la evidencia.** No asumas que existe un
   tratamiento de datos, una base legal, o una infracción que no esté
   respaldada por un campo concreto del JSON de entrada. Si falta
   información para confirmar algo, dilo explícitamente — no rellenes
   huecos con suposiciones.
2. **Ante la duda, sube la severidad, nunca la asumas ausente.** Si una
   cookie de un tracker conocido aparece en `cookiesSetBeforeConsent`, eso
   ES una infracción de consentimiento (RGPD art. 7 + ePrivacy) —
   repórtala siempre como severidad ALTA, sin excepción, salvo que el
   `setBy`/nombre indique claramente que es técnicamente necesaria
   (sesión, CSRF, carrito de compra).
3. **Cita la evidencia técnica exacta**, nunca una afirmación genérica.
   "Se han detectado cookies de tracking" está prohibido; en su lugar:
   "La cookie `_ga` (Google Analytics) de dominio `.example.com` se
   estableció en la primera carga de página, antes de cualquier
   interacción con el banner de consentimiento."
4. **Aplica solo las normativas relevantes según `businessContext`.** No
   apliques CCPA/CPRA si `targetsCaliforniaUsers` es false. No apliques
   RGPD/ePrivacy si `targetsEuUsers` es false. Si ambos son true, audita
   contra ambos marcos y señala cuándo un mismo hallazgo infringe los dos.
5. **No emitas asesoramiento legal definitivo, emite un análisis de
   riesgo basado en evidencia técnica.** Cada `legalJustification` debe
   sonar a "esto es lo que la normativa exige y esto es lo que se detectó
   que no se cumple", no a una opinión legal vinculante. Este análisis es
   un punto de partida para revisión profesional, no un dictamen final.
6. **Transferencias internacionales**: si un tracker tiene
   `usDataTransfer: true` y `targetsEuUsers` es true, y no hay evidencia
   en `existingLegalPages` de mención a Cláusulas Contractuales Tipo (SCC)
   o mecanismo de transferencia adecuado, repórtalo como
   `TRANSFERENCIA_INTERNACIONAL` de severidad ALTA.
7. **Patrones oscuros**: `rejectAsEasyAsAccept: false` en presencia de un
   CMP es SIEMPRE una violación `PATRON_OSCURO_DARK_PATTERN` de severidad
   ALTA (RGPD art. 7.3 exige que retirar el consentimiento sea tan fácil
   como darlo; la misma lógica aplica a rechazar vs. aceptar inicialmente
   según guías de EDPB/AEPD). Un `checkboxPreChecked: true` en cualquier
   formulario es también severidad ALTA (consentimiento no puede
   presumirse por omisión, RGPD art. 4.11 y considerando 32).
8. **No hay política de privacidad o de cookies (`found: false`)** es
   siempre severidad ALTA por sí sola (RGPD arts. 12-14; en España además
   LSSI-CE art. 22.2 para cookies) — infórmalo como violación aunque no
   haya más evidencia técnica que auditar de su contenido.
9. **Nunca output texto libre fuera del schema.** Tu única salida es el
   objeto JSON validado contra el schema proporcionado. No añadas
   explicaciones antes o después.

## Cálculo de riskScore (guía, no fórmula rígida — usa criterio, pero
sé consistente entre auditorías similares)

- Empieza en 0.
- Cada violación ALTA: +18 a +25 puntos según severidad relativa dentro
  de la categoría.
- Cada violación MEDIA: +8 a +12 puntos.
- Cada violación BAJA: +2 a +5 puntos.
- Cap en 100. Un solo patrón oscuro confirmado o ausencia total de
  política de privacidad debe por sí solo llevar el score a AMBAR alto o
  ROJO — nunca lo diluyas promediando con aspectos que sí cumplen.

## Formato de entrada

Recibirás un objeto JSON que cumple `TechnicalAuditPayload` (ver
`src/scanner/types.ts`) con la evidencia técnica del escaneo, y el texto
plano de la política de privacidad/cookies/T&C actuales si el escáner
los encontró.

## Formato de salida

Responde exclusivamente con un objeto que cumpla el schema
`AuditReportSchema` proporcionado vía `output_config.format`.
```

Llamada de ejemplo con el SDK:

```ts
// src/ai/audit-website.ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AuditReportSchema } from "./schemas/audit-report.schema";
import { AUDIT_SYSTEM_PROMPT } from "./prompts/audit-system-prompt";
import type { TechnicalAuditPayload } from "@/scanner/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function auditWebsite(payload: TechnicalAuditPayload) {
  const stream = anthropic.messages.stream({
    model: "claude-opus-5",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: AUDIT_SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(AuditReportSchema, "audit_report") },
    messages: [
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    timeout: 10 * 60 * 1000,
  });

  const finalMessage = await stream.finalMessage();
  if (!finalMessage.parsed_output) {
    throw new Error("El modelo no devolvió un audit_report válido tras reintentos");
  }
  return finalMessage.parsed_output;
}
```

### 2.2 Prompt 2 — Generador legal a medida

```text
# system prompt — Prompt 2: Generador de Documentación Legal

Eres un redactor legal técnico especializado en documentos de privacidad
para sitios web (Política de Privacidad, Política de Cookies, Términos y
Condiciones), conforme a RGPD, ePrivacy/LSSI-CE, CCPA y CPRA según
corresponda. Generas documentos EN MARKDOWN limpio, listos para publicar,
adaptados exactamente a las herramientas técnicas reales detectadas en el
sitio — nunca una plantilla genérica de relleno.

## Reglas de oro

1. **Nunca inventes datos que no están en la entrada.** Si `companyName`,
   dirección, o email de contacto no están en `businessContext`, usa un
   placeholder explícito y visible: `[NOMBRE DE LA EMPRESA]`,
   `[DIRECCIÓN FISCAL]`, `[EMAIL DE CONTACTO PARA EJERCER DERECHOS]`.
   Nunca los reemplaces por un ejemplo inventado ("Acme Corp, S.L.") — eso
   induciría al cliente a publicar un documento con datos falsos por
   error.
2. **Cada herramienta detectada en `trackersDetected` debe aparecer
   nombrada explícitamente** en la tabla de cookies/tratamientos, con su
   categoría, finalidad, y si transfiere datos a EE. UU.. No agrupes
   herramientas distintas bajo una descripción genérica ("usamos
   analíticas") — nombra Google Analytics 4, Meta Pixel, etc.
   explícitamente, tal como la normativa de transparencia exige
   (RGPD art. 13.1.e, 13.1.f).
3. **Incluye base legal por finalidad**, no una única base legal para
   todo el tratamiento: analítica/publicidad → consentimiento (RGPD
   art. 6.1.a); gestión de compra/factura → ejecución de contrato /
   obligación legal (art. 6.1.b/c); email transaccional → interés
   legítimo (art. 6.1.f) razonado brevemente.
4. **Si `usDataTransfer: true` en alguna herramienta y `targetsEuUsers`
   es true**, incluye una sección de "Transferencias internacionales de
   datos" mencionando el mecanismo aplicable en términos generales
   (Cláusulas Contractuales Tipo de la Comisión Europea) — sin afirmar
   que el proveedor concreto las tiene firmadas si no hay evidencia,
   redacta en condicional/orientativo: "Cuando esta herramienta transfiera
   datos fuera del EEE, dicha transferencia se ampara en las Cláusulas
   Contractuales Tipo de la Comisión Europea u otro mecanismo adecuado
   conforme al Capítulo V del RGPD."
5. **La Política de Cookies debe incluir SIEMPRE una tabla** con columnas:
   Nombre de cookie | Proveedor | Finalidad | Duración | Tipo (propia/
   tercero) | ¿Requiere consentimiento?. Rellena duración con
   `typicalCookieDurations` si viene en la entrada; si no, usa
   "Ver política del proveedor" en vez de inventar un número.
6. **Términos y Condiciones**: incluye SIEMPRE una cláusula de limitación
   de responsabilidad, condiciones de uso aceptable, política de
   cancelación/devolución si `sellsOnline` es true, y ley aplicable/
   jurisdicción con placeholder `[JURISDICCIÓN]` si no se especifica.
7. **Encabezado obligatorio en los TRES documentos**, verbatim (no lo
   reformules): la nota legal de la sección 5.1 de este blueprint
   ("Este documento ha sido generado con asistencia de inteligencia
   artificial... no constituye asesoramiento legal formal..."). Va
   siempre al principio del documento, no al final ni en nota a pie.
8. **Idioma y estilo**: castellano neutro salvo que `businessContext`
   indique otro idioma objetivo; registro formal-jurídico pero legible,
   evita jerga innecesaria; usa listas y tablas Markdown, nunca HTML.
9. **No output nada fuera de los tres documentos solicitados.** Si se
   pide solo uno (`documentType`), genera solo ese, con el mismo rigor.

## Formato de entrada

Un objeto JSON con: `businessContext` (igual que en el Prompt 1),
`trackersDetected`, `forms`, `existingLegalPages` (para mantener
coherencia de tono/estructura si el cliente ya tenía algo publicado,
nunca para copiarlo literalmente si es defectuoso), y `documentType`
(`"privacy_policy" | "cookie_policy" | "terms_and_conditions" | "all"`).

## Formato de salida

Markdown puro. Si `documentType` es `"all"`, separa los tres documentos
con un delimitador exacto `\n\n---DOCUMENT_BREAK---\n\n` en este orden:
Política de Privacidad, Política de Cookies, Términos y Condiciones —
para que el backend pueda partirlos de forma determinista sin volver a
llamar al modelo.
```

```ts
// src/ai/generate-legal-docs.ts
import Anthropic from "@anthropic-ai/sdk";
import { LEGAL_DOCS_SYSTEM_PROMPT } from "./prompts/legal-docs-system-prompt";
import type { TechnicalAuditPayload } from "@/scanner/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateLegalDocuments(
  payload: Pick<TechnicalAuditPayload, "businessContext" | "trackersDetected" | "forms" | "existingLegalPages">,
  documentType: "privacy_policy" | "cookie_policy" | "terms_and_conditions" | "all",
) {
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system: LEGAL_DOCS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify({ ...payload, documentType }) }],
    timeout: 10 * 60 * 1000,
  });

  const finalMessage = await stream.finalMessage();
  const text = finalMessage.content.find((b) => b.type === "text")?.text ?? "";

  if (documentType === "all") {
    const [privacyPolicy, cookiePolicy, termsAndConditions] = text.split("---DOCUMENT_BREAK---").map((s) => s.trim());
    return { privacyPolicy, cookiePolicy, termsAndConditions };
  }
  return { [documentType]: text.trim() };
}
```

---

## 3. Base de datos y API endpoints

### 3.1 Esquema SQL (PostgreSQL)

```sql
-- === Users ===
CREATE TYPE user_role AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,                     -- null si login solo OAuth
  name            TEXT,
  company_name    TEXT,
  role            user_role NOT NULL DEFAULT 'OWNER',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Websites (el activo que se audita, repetible en el tiempo) ===
CREATE TABLE websites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  label           TEXT,                     -- nombre amigable, útil en plan Agencia multi-cliente
  business_context JSONB NOT NULL DEFAULT '{}'::jsonb, -- ver businessContext del payload
  monitoring_enabled BOOLEAN NOT NULL DEFAULT false,     -- rescaneo periódico (plan Agencia/Pro)
  monitoring_frequency_days INTEGER NOT NULL DEFAULT 30,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

-- === Scans (una ejecución del crawler) ===
CREATE TYPE scan_status AS ENUM ('QUEUED', 'CRAWLING', 'AUDITING', 'READY', 'FAILED');

CREATE TABLE scans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id            UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  status                scan_status NOT NULL DEFAULT 'QUEUED',
  technical_payload      JSONB,             -- TechnicalAuditPayload completo (evidencia cruda)
  is_free_teaser        BOOLEAN NOT NULL DEFAULT true, -- primer scan gratuito no desbloqueado
  error_message         TEXT,
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scans_website_id ON scans(website_id);
CREATE INDEX idx_scans_status ON scans(status) WHERE status IN ('QUEUED', 'CRAWLING', 'AUDITING');

-- === AuditReports (salida del Prompt 1, 1:1 con un scan) ===
CREATE TYPE risk_level AS ENUM ('VERDE', 'AMBAR', 'ROJO');

CREATE TABLE audit_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
  risk_score      INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level      risk_level NOT NULL,
  applicable_regulations TEXT[] NOT NULL,
  violations      JSONB NOT NULL,           -- array de ViolationSchema
  executive_summary TEXT NOT NULL,
  prompt_version  TEXT NOT NULL,            -- para poder correlacionar con cambios de prompt
  model_used      TEXT NOT NULL,
  unlocked        BOOLEAN NOT NULL DEFAULT false, -- true tras pago o suscripción activa
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === GeneratedDocuments (salida del Prompt 2, N por scan: puede regenerarse) ===
CREATE TYPE legal_document_type AS ENUM ('PRIVACY_POLICY', 'COOKIE_POLICY', 'TERMS_AND_CONDITIONS');

CREATE TABLE generated_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  document_type   legal_document_type NOT NULL,
  content_markdown TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  prompt_version  TEXT NOT NULL,
  model_used      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_id, document_type, version)
);

-- === Subscriptions (Stripe) ===
CREATE TYPE subscription_plan AS ENUM ('FREE', 'REPORT_ONE_TIME', 'PRO', 'AGENCY');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan                    subscription_plan NOT NULL DEFAULT 'FREE',
  status                  subscription_status NOT NULL DEFAULT 'ACTIVE',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ledger append-only para compras puntuales de informe ($39) — mismo
-- patrón que el ledger de créditos de RFPilot: nunca un contador mutable.
CREATE TABLE report_unlocks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audit_report_id       UUID NOT NULL REFERENCES audit_reports(id),
  stripe_checkout_session_id TEXT NOT NULL UNIQUE, -- idempotencia de webhook
  amount_cents          INTEGER NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Endpoints clave

```ts
// src/app/api/scan/route.ts
// POST { url: string, businessContext: BusinessContext } -> { scanId, websiteId }
// - valida la URL (formato + no localhost/IP privada, evitar SSRF hacia red interna)
// - valida el checkbox de autorización (ver sección 5.4)
// - rate limit por IP (3 scans/hora sin cuenta) y por user_id si autenticado
// - crea website + scan (status QUEUED), dispara evento Inngest "scan/requested"
// - devuelve 202 Accepted con el scanId para polling

// src/app/api/scan/[scanId]/status/route.ts
// GET -> { status, riskScore?, riskLevel?, violationsCount? } (teaser sin detalle si !unlocked)
// - usado por el frontend para pollear mientras status no es READY/FAILED

// src/app/api/generate-docs/route.ts
// POST { scanId, documentType } -> { documents: {...} }
// - requiere: auditReport.unlocked === true (pago verificado) O plan PRO/AGENCY activo
// - dispara Prompt 2 síncrono si el payload es pequeño, o vía Inngest si se pide "all"
//   (generar los 3 documentos puede acercarse al límite razonable de una request)

// src/app/api/webhook/stripe/route.ts
// POST (raw body, verificado con STRIPE_WEBHOOK_SECRET)
// checkout.session.completed:
//   - metadata.type === 'report_unlock' -> inserta report_unlocks (idempotente por
//     stripe_checkout_session_id), marca audit_reports.unlocked = true
//   - metadata.type === 'subscription' -> upsert subscriptions
// customer.subscription.updated / deleted -> sincroniza status/plan/current_period_end
// invoice.paid con billing_reason === 'subscription_cycle' -> no-op de negocio aquí
//   (el valor del plan PRO/AGENCY es "acceso ilimitado mientras ACTIVE", no créditos)
```

```ts
// src/app/api/scan/route.ts (implementación de referencia)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { db } from "@/server/db";
import { requireRateLimit } from "@/server/rate-limit";
import { isSafeExternalUrl } from "@/scanner/url-safety";

const ScanRequestSchema = z.object({
  url: z.string().url(),
  authorizedByOwner: z.literal(true), // checkbox obligatorio, ver sección 5.4
  businessContext: z.object({
    companyName: z.string().optional(),
    countryOfEstablishment: z.string().optional(),
    targetsEuUsers: z.boolean(),
    targetsCaliforniaUsers: z.boolean(),
    sellsOnline: z.boolean(),
    hasEmployeesOrHr: z.boolean(),
  }),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = ScanRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { url, businessContext } = parsed.data;

  // Evita SSRF: bloquea localhost, IPs privadas/loopback, y esquemas != http(s).
  if (!(await isSafeExternalUrl(url))) {
    return NextResponse.json({ error: "url_not_allowed" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitOk = await requireRateLimit(`scan:ip:${ip}`, { max: 3, windowMinutes: 60 });
  if (!rateLimitOk) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const session = await getOptionalSession(req); // null si el usuario aún no tiene cuenta

  const website = await db.website.upsert({
    where: session ? { userId_url: { userId: session.userId, url } } : undefined,
    create: { userId: session?.userId ?? (await ensureAnonymousUser(ip)), url, businessContext },
    update: { businessContext },
  });

  const scan = await db.scan.create({
    data: { websiteId: website.id, status: "QUEUED", isFreeTeaser: true },
  });

  await inngest.send({ name: "scan/requested", data: { scanId: scan.id } });

  return NextResponse.json({ scanId: scan.id, websiteId: website.id }, { status: 202 });
}
```

---

## 4. UX y onboarding de alta conversión

### 4.1 Flujo paso a paso

```
1. LANDING (/)
   Input grande: "Introduce la URL de tu web" + botón "Analizar gratis"
   Micro-copy de confianza: "Sin tarjeta. Resultado en 60 segundos."
   Checkbox obligatorio, pequeño pero visible: "Confirmo que soy el
   propietario de este sitio o tengo autorización para analizarlo."
        │
        ▼
2. FORMULARIO DE CONTEXTO (4 preguntas, <20s de rellenar)
   - "¿Tu web vende a usuarios de la UE?" [Sí/No]
   - "¿Vende a usuarios de California (EE. UU.)?" [Sí/No]
   - "¿Vendes productos/servicios online (checkout)?" [Sí/No]
   - Nombre de empresa (opcional en este paso)
   -> POST /api/scan, redirige a /scan/[scanId] inmediatamente
        │
        ▼
3. PANTALLA DE PROGRESO (/scan/[scanId])
   Pasos visibles en tiempo real (mismo patrón que el estado del pipeline
   de RFPilot: "Subiendo" -> "Extrayendo" -> "Analizando" -> "Listo"):
     ○ Rastreando tu web...
     ○ Detectando cookies y scripts de terceros...
     ○ Comparando antes/después del consentimiento...
     ○ Auditando con IA contra RGPD/CCPA...
   Polling a GET /api/scan/[scanId]/status cada 2s.
        │
        ▼
4. TEASER GRATUITO (/scan/[scanId]/report) — el lead magnet
   - Semáforo grande (VERDE/ÁMBAR/ROJO) + riskScore visible en grande.
   - Resumen ejecutivo completo (texto, gratis — da valor real inmediato).
   - Lista de violaciones: título + severidad + regulación SIEMPRE visibles;
     `legalJustification` y `recommendedFix` bajo un blur/lock overlay con
     icono de candado: "Desbloquea el informe completo por $39".
   - Contador: "Se han detectado N infracciones (M de severidad ALTA)".
   - CTA primario: botón Stripe Checkout $39 (informe completo + 3 documentos
     legales generados y descargables).
   - CTA secundario, más discreto: "¿Gestionas varias webs? Ver plan Agencia".
        │
        ├── Paga $39 (report_unlock) ──────────────┐
        │                                            ▼
        │                              5a. INFORME DESBLOQUEADO
        │                                 - todas las violations expandidas
        │                                 - botón "Generar documentos legales"
        │                                   -> POST /api/generate-docs
        │                                 - descarga en Markdown/.docx/copia directa
        │                                 - CTA de upsell suave a monitorización
        │                                   mensual ("vuelve a escanear en 30 días")
        │
        └── Se suscribe a Pro/Agencia ──────────────┐
                                                       ▼
                                         5b. DASHBOARD MULTI-WEB
                                            - añade N webs (Agencia: multi-cliente,
                                              marca blanca en el PDF exportado)
                                            - monitorización automática periódica
                                              (Inngest cron -> rescan -> email si
                                              el riskLevel empeora o aparece un
                                              tracker nuevo no documentado)
                                            - historial de score en el tiempo
```

Elección deliberada de UX: **el escaneo corre sin pedir email ni tarjeta**
— el email solo se pide, como mucho, para poder volver a acceder al
informe desde otro dispositivo (magic link), nunca como gate previo al
resultado gratuito. El resumen ejecutivo y el semáforo son gratis y
completos; lo que se bloquea es el *detalle accionable* (justificación
línea por línea + fix concreto + los documentos generados) — esto es lo
que de verdad vale $39 y es lo que un dueño de PYME no puede reconstruir
por sí mismo con el teaser.

### 4.2 Componentes shadcn/ui clave

```tsx
// src/components/report/risk-semaphore.tsx
import { cn } from "@/lib/utils";

const LEVEL_CONFIG = {
  VERDE: { color: "bg-emerald-500", label: "Riesgo bajo", ring: "ring-emerald-500/30" },
  AMBAR: { color: "bg-amber-500", label: "Riesgo medio", ring: "ring-amber-500/30" },
  ROJO: { color: "bg-red-500", label: "Riesgo alto", ring: "ring-red-500/30" },
} as const;

export function RiskSemaphore({ level, score }: { level: keyof typeof LEVEL_CONFIG; score: number }) {
  const config = LEVEL_CONFIG[level];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn("flex h-32 w-32 items-center justify-center rounded-full ring-8", config.color, config.ring)}>
        <span className="text-4xl font-bold text-white">{score}</span>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold">{config.label}</p>
        <p className="text-sm text-muted-foreground">Puntuación de riesgo sobre 100</p>
      </div>
    </div>
  );
}
```

```tsx
// src/components/report/violation-card.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY_VARIANT = {
  ALTA: "destructive",
  MEDIA: "default",
  BAJA: "secondary",
} as const;

export function ViolationCard({
  violation,
  locked,
}: {
  violation: {
    category: string;
    severity: "ALTA" | "MEDIA" | "BAJA";
    regulationsViolated: string[];
    evidence: string;
    legalJustification: string;
    recommendedFix: string;
  };
  locked: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-medium">{violation.category.replaceAll("_", " ")}</CardTitle>
        <div className="flex gap-2">
          {violation.regulationsViolated.map((r) => (
            <Badge key={r} variant="outline">{r}</Badge>
          ))}
          <Badge variant={SEVERITY_VARIANT[violation.severity]}>{violation.severity}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{violation.evidence}</p>
        <div className={cn("relative rounded-md border p-3", locked && "overflow-hidden")}>
          <p className="text-sm"><strong>Por qué importa:</strong> {violation.legalJustification}</p>
          <p className="mt-1 text-sm"><strong>Cómo solucionarlo:</strong> {violation.recommendedFix}</p>
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">Desbloquea el informe completo</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/components/report/scan-progress.tsx — mismo patrón de estados que RFPilot
const STEPS = [
  { key: "CRAWLING", label: "Rastreando tu web y detectando cookies/scripts" },
  { key: "CONSENT_DIFF", label: "Comparando antes/después del consentimiento" },
  { key: "AUDITING", label: "Auditando con IA contra RGPD/CCPA" },
] as const;

export function ScanProgress({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStatus);
  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex items-center gap-3">
          <span
            className={
              i < currentIndex ? "h-2 w-2 rounded-full bg-emerald-500" :
              i === currentIndex ? "h-2 w-2 animate-pulse rounded-full bg-primary" :
              "h-2 w-2 rounded-full bg-muted"
            }
          />
          <span className={i <= currentIndex ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
```

### 4.3 Pricing

| Plan | Precio | Para quién | Incluye |
|---|---|---|---|
| Escaneo gratis | $0 | Cualquiera, sin cuenta | Semáforo + resumen ejecutivo + nº de infracciones |
| Informe completo | $39 pago único | Dueño de 1 web | Detalle línea a línea + 3 documentos legales generados y editables |
| Pro | $59/mes | Freelancer/PYME con 1-3 webs | Todo lo anterior + monitorización mensual automática + alertas por email |
| Agencia | $99/mes | Agencias/consultoras | Webs ilimitadas, multi-cliente, informes con marca blanca, exportación PDF con logo propio |

---

## 5. Mitigación de riesgo legal del propio SaaS

### 5.1 Disclaimer obligatorio (encabezado de todo documento generado + banner en el informe)

```text
AVISO IMPORTANTE: Este documento/informe ha sido generado con asistencia
de inteligencia artificial a partir de un análisis técnico automatizado
del sitio web indicado. Se ofrece como herramienta de orientación y punto
de partida para el cumplimiento normativo, y NO CONSTITUYE ASESORAMIENTO
LEGAL FORMAL ni sustituye la revisión de un profesional del derecho
colegiado. [NOMBRE DEL SAAS] no garantiza que el uso de este documento,
tal cual, resulte en el cumplimiento íntegro de RGPD, CCPA, CPRA, ePrivacy
ni de ninguna otra normativa aplicable. El análisis técnico solo detecta
lo observable desde el navegador en el momento del escaneo y puede no
identificar todos los tratamientos de datos, integraciones de terceros
cargadas condicionalmente, o requisitos específicos de tu sector o
jurisdicción. Recomendamos encarecidamente la revisión de este contenido
por un abogado especializado en protección de datos antes de su
publicación o uso frente a terceros.
```

Este texto va: (a) como primer bloque de cada documento Markdown generado
(ya forzado por el system prompt del Prompt 2, ver 2.2 regla 7), (b) como
banner fijo en la cabecera de la pantalla de informe en la UI, (c) en los
Términos de Servicio del propio SaaS.

### 5.2 Cláusula de limitación de responsabilidad (ToS del SaaS)

```text
8. Limitación de responsabilidad

8.1. El Servicio proporciona análisis automatizados y documentos generados
mediante inteligencia artificial con fines informativos y de apoyo a la
gestión de cumplimiento normativo. El Usuario reconoce y acepta que dichos
análisis y documentos no constituyen asesoramiento legal y que su
idoneidad para el caso concreto del Usuario debe ser validada por un
profesional cualificado antes de su implementación.

8.2. [NOMBRE DEL SAAS] no será responsable de sanciones, multas,
reclamaciones de terceros, ni daños directos, indirectos, incidentales o
consecuentes derivados del uso, implementación o confianza depositada en
los informes o documentos generados por el Servicio.

8.3. En cualquier caso, y en la máxima medida permitida por la ley
aplicable, la responsabilidad total de [NOMBRE DEL SAAS] frente al
Usuario por cualquier reclamación relacionada con el Servicio no excederá
el importe efectivamente abonado por el Usuario en los doce (12) meses
anteriores al hecho que origina la reclamación.

8.4. El Usuario declara y garantiza ser el titular del sitio web
analizado, o contar con la autorización expresa de su titular, para
autorizar el escaneo técnico del mismo por parte del Servicio.
```

### 5.3 Buenas prácticas operativas para el propio SaaS

1. **Seguro de responsabilidad civil profesional (E&O / Professional
   Indemnity)** — imprescindible antes de facturar de forma seria; cubre
   precisamente el escenario "un cliente alega que confió en nuestro
   informe y fue sancionado".
2. **Nunca prometer "100% conforme" en marketing ni en producto.** Todo
   copy usa "reduce tu riesgo", "identifica infracciones comunes",
   "punto de partida", nunca "garantiza el cumplimiento" — es tanto una
   protección legal como una cuestión de honestidad: el escáner no puede
   ver tratamientos offline, acuerdos con proveedores, ni lógica cargada
   condicionalmente que el crawler no dispara.
3. **Versionado y trazabilidad de cada informe/documento** (`prompt_version`,
   `model_used`, `technical_payload` completo guardado) — si años después
   un cliente reclama, poder reconstruir exactamente qué evidencia se
   auditó y qué prompt generó qué texto es la mejor defensa posible frente
   a una reclamación, y es simplemente buena práctica de auditabilidad.
4. **Revisión legal humana como upsell, no como gate.** Ofrecer, como
   producto adicional o partnership con un despacho/marketplace legal, la
   opción de "revisión por abogado humano" sobre el documento generado —
   convierte el disclaimer en una oportunidad de ingreso adicional en vez
   de solo una cobertura de riesgo.
5. **El propio SaaS es RGPD-compliant de puertas para dentro.** Aunque el
   dato de entrada principal (URLs de terceros) no es dato personal, el
   SaaS sí trata datos personales de sus propios usuarios (email, empresa,
   pagos): política de privacidad propia real (no generada por su propio
   Prompt 2 sin revisión), Data Processing Agreement con subencargados
   (Anthropic, Stripe, proveedor de hosting/DB), lista de subencargados
   publicada, y retención de `technical_payload`/informes limitada y
   documentada (p.ej. 24 meses, purgable a petición).
6. **Alcance del escaneo limitado a lo públicamente accesible.** El
   crawler nunca debe intentar bypasear autenticación, CAPTCHAs, ni rate
   limits del sitio objetivo — solo páginas públicas normales, respetando
   `robots.txt` cuando sea razonable y limitando la frecuencia de request
   por dominio (evita que el escaneo se confunda con un scraping abusivo
   o, en el peor caso, con una herramienta de reconocimiento no
   autorizada contra el sitio de un tercero).
7. **Confirmación de autorización explícita del usuario antes de escanear
   cualquier dominio** (checkbox obligatorio en el formulario de escaneo,
   ver 3.2/4.1) — además de ser buena práctica ética, es la barrera que
   evita que el producto se use para escanear el sitio de un competidor
   sin relación con el usuario; guardar esa aceptación (timestamp + IP)
   como evidencia.
8. **No almacenar en claro credenciales ni datos sensibles del sitio
   objetivo.** El crawler no debe rellenar formularios de login ni de
   pago reales del sitio auditado — el análisis de "formularios" (sección
   1.5) es estructural (qué campos pide, si hay checkbox de consentimiento),
   nunca envía datos de prueba que puedan generar efectos reales
   (compras, altas, envío de emails a terceros).
9. **Jurisdicción cubierta, explícita y limitada.** El producto se
   posiciona explícitamente para RGPD/ePrivacy (UE/EEE) y CCPA/CPRA
   (California) — cualquier otra normativa (LGPD de Brasil, PIPEDA de
   Canadá, etc.) se declara fuera de alcance hasta que se audite y
   valide con un experto local, en vez de dar a entender cobertura
   global implícita.

### 5.4 Checklist de autorización en el flujo de escaneo

```tsx
// fragmento del formulario de la pantalla 1 (landing)
<label className="flex items-start gap-2 text-sm">
  <Checkbox required name="authorizedByOwner" />
  <span>
    Confirmo que soy el propietario de este sitio web o cuento con
    autorización expresa de su titular para analizarlo técnicamente.
  </span>
</label>
```

El backend rechaza la request si `authorizedByOwner !== true` (ver schema
en `src/app/api/scan/route.ts`, sección 3.2) — no es solo copy en la UI,
es una validación real en el endpoint.
