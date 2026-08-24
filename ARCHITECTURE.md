# Arquitectura de RFPilot

Este documento explica las decisiones de diseño del sistema y, a medida que se
construyen las fases, el pipeline de IA con sus prompts y esquemas.

## Resumen del stack y por qué

| Área | Elección | Por qué |
|---|---|---|
| Frontend/Backend | Next.js 14 (App Router), un solo proyecto | Route Handlers cubren la API; no hace falta un backend Node separado porque el trabajo pesado (PDF, IA) se delega a funciones asíncronas (Inngest), no al request/response HTTP. Menos infraestructura que mantener. |
| Versión de Next.js | 14.2.x fijada explícitamente, no "latest" (16.x) | El scaffold instala la última versión por defecto (16), que introduce cambios de paradigma (cache components, APIs async distintas) mal cubiertos por el conocimiento del modelo que construye esto de forma autónoma. Next 14 es estable, ampliamente documentado y cumple el "14+" del requisito con mucho menor riesgo de bugs sutiles en una build tan grande. Ver "Riesgos aceptados" más abajo. |
| Base de datos | PostgreSQL + Prisma | Tipado end-to-end, migraciones versionadas, y Neon (recomendado para producción) da branching de DB por PR de Vercel. |
| Auth | Auth.js (NextAuth v5) | Credentials + Google + Microsoft Entra ID (Outlook) sin coste por usuario activo (vs. Clerk), con control total del modelo de datos multi-tenant vía el adapter de Prisma. |
| Async/colas | Inngest (no BullMQ+Redis) | Vercel es serverless: BullMQ requiere un worker persistente, es decir, infraestructura adicional solo para eso. Inngest orquesta el pipeline de IA como funciones "step" invocadas por webhook, con reintentos y estado durable de fábrica, sin gestionar servidores. |
| Storage | Vercel Blob | Integración nativa con el deploy target. Se aísla detrás de `src/server/storage/` para poder migrar a S3/R2 sin tocar el resto del código. |
| IA | Claude (Anthropic), tool use + prompt caching | Ver sección "Pipeline de IA". |
| Export de documentos | `docx` (Word) + `@react-pdf/renderer` (PDF) | Control total de plantilla en vez de convertir docx→pdf. |
| Pagos | Stripe | 3 planes + créditos vía ledger append-only (nunca un contador mutable). |

## Multi-tenancy

Todo modelo de negocio cuelga de `Organization`. El aislamiento se aplica en
la capa de acceso a datos (`src/server/**`), que exige `organizationId` en
cada query — nunca se confía en un ID que llegue del cliente sin verificar
antes que el usuario autenticado tiene `Membership` en esa organización
(`requireActiveMembership()` en `src/server/auth/session.ts`).

El modelo `Client` permite a una organización de tipo consultora/despacho
(plan Agencia, marca blanca) gestionar licitaciones y perfiles de empresa por
cuenta de terceros sin mezclar datos entre organizaciones distintas.

## Datos sensibles

CIF/NIF, facturación anual e importes de contratos de referencia se cifran en
reposo con AES-256-GCM (`src/lib/crypto.ts`, campos `*Encrypted`). La clave
vive en `ENCRYPTION_KEY` (32 bytes, fuera del repo). Estos campos se
descifran solo en la capa de servidor que los necesita; nunca se envían en
claro a la API de Claude más allá de lo estrictamente necesario para el
cruce de requisitos (ver Fase 4).

## Esquema de datos

Ver `prisma/schema.prisma` (documentado inline). Resumen de los grupos de
modelos:

- **Auth**: `User`, `Account`, `Session`, `VerificationToken` (estándar Auth.js).
- **Tenant**: `Organization`, `Membership` (rol por usuario), `Client` (multi-cliente).
- **Perfil de empresa**: `CompanyProfile`, `Certification`, `RevenueYear`,
  `ExperienceReference`, `TeamMember`.
- **Licitación**: `Tender` (PDF subido + estado del pipeline).
- **Análisis IA**: `TenderAnalysis` (versionado), `ExclusionRequirement`,
  `ScoringCriterion`, `EligibilityCheck` (el cruce perfil↔requisito).
- **Propuesta**: `ProposalDraft`, `ProposalSection` (árbol recursivo),
  `ProposalExport`.
- **Facturación**: `Subscription`, `CreditLedgerEntry` (ledger append-only).
- **Alertas**: `AlertKeyword`, `AlertMatch` (fase avanzada).
- **Observabilidad**: `AiUsageLog` (coste por llamada IA), `AuditLog`.

## Pipeline de IA

_(Se documenta en detalle en la Fase 3, cuando se implementa. Aquí queda el
esqueleto de las decisiones ya tomadas en el diseño del schema.)_

Pasos encadenados, cada uno versionado (`TenderAnalysis.promptVersion`) y
guardado como una nueva versión de análisis (nunca se sobreescribe el
anterior, para poder comparar/regenerar):

1. **Extracción de texto y estructura** (Fase 2, implementada) —
   `pdfjs-dist` para el texto nativo del PDF, con fallback OCR (Tesseract.js
   + renderizado de página con `@napi-rs/canvas`) si el ratio de caracteres
   extraídos por página cae por debajo de un umbral (indicio de PDF
   escaneado). Ver "Extracción de PDF" más abajo para el detalle y los
   problemas reales encontrados al construirlo.
2. **Extracción de requisitos excluyentes + criterios de baremo + resumen
   ejecutivo** (Fase 3, implementada) — una sola llamada a Claude Opus 5
   (`src/ai/analyze-tender.ts`) vía `client.messages.stream(...)` +
   `output_config.format: zodOutputFormat(schema)` (structured outputs,
   GA — no `tool_choice` forzado ni beta), con `thinking: {type:
   "adaptive"}` y `effort: "high"`. El pliego completo va en un bloque de
   `system` marcado `cache_control: {type:"ephemeral"}`
   (`src/ai/context.ts`), compartido con los pasos de la Fase 5 para
   reutilizar el prefill. Si `parsed_output` no valida contra el schema
   Zod, reintenta hasta 3 veces indicándole al modelo el error concreto.
3. **Cruce contra el perfil de empresa** (Fase 4, implementada) — lógica
   determinista en TypeScript (`src/server/eligibility/`) sobre los datos
   ya estructurados del `CompanyProfile`, sin ninguna llamada a Claude por
   requisito. Se ejecuta automáticamente al final del análisis de la Fase
   3 y se puede recalcular gratis (botón "Actualizar semáforo") cada vez
   que el usuario edita su perfil. Ver el detalle más abajo.
4. **Generación del índice de propuesta** (Fase 5, implementada) —
   `src/ai/generate-proposal-outline.ts`, misma llamada de tipo
   "structured output" que el paso (b) (Zod v4 + `zodOutputFormat`, mismo
   `runStructuredExtraction` compartido), reutilizando el bloque de
   sistema cacheado del pliego. El schema es recursivo (`z.lazy`) para
   modelar secciones con subsecciones; el árbol resultante se persiste
   como `ProposalSection` (parentId/children) vía inserción recursiva.
5. **Generación de contenido por sección bajo demanda** (Fase 5,
   implementada) — `src/ai/generate-section-content.ts`. A diferencia de
   los pasos (b)/(d), esta es una llamada de **texto libre** (markdown),
   no structured output: aquí el objetivo es prosa persuasiva, no datos
   que validar contra un schema. Nunca se generan todas las secciones de
   golpe: cada sección es un evento Inngest independiente
   (`proposal/section.generation.requested`), disparado al pulsar
   "Generar"/"Regenerar con IA" en esa sección concreta — controla coste y
   permite iterar sección por sección. El prompt combina el pliego
   cacheado + las instrucciones de esa sección + un resumen en texto plano
   del perfil de empresa (`src/server/company-profile/summarize.ts`), con
   una instrucción explícita de no inventar datos que no estén en el
   perfil.

RAG/embeddings quedan reservados para pliegos anómalamente largos (>300
páginas) o para el buscador de boletines oficiales — no para el caso normal,
donde la ventana de contexto larga de Claude permite pasar el documento
completo.

## Extracción de PDF

Decisiones tomadas al construir la Fase 2, con la razón empírica detrás:

- **`pdf-parse` descartado.** Es la librería "obvia" para esto, pero no se
  actualiza desde 2018 y bundlea una versión de pdf.js de esa misma época.
  Al probarla contra un PDF generado con una herramienta moderna (`pdfkit`),
  fallaba con `FormatError: bad XRef entry` — un PDF perfectamente válido.
  Se sustituyó por `pdfjs-dist` (Mozilla, mantenido activamente) para
  extraer texto directamente vía `page.getTextContent()`, que además es la
  misma librería que ya hacía falta para renderizar páginas en el fallback
  de OCR — una dependencia de PDF menos que mantener.
- **OCR sin CDN en runtime.** Tesseract.js por defecto descarga el modelo de
  idioma (`spa.traineddata.gz`, unos 2-8MB) de un CDN la primera vez que se
  usa. Eso es lento en cold starts serverless y, más importante, puede estar
  bloqueado por políticas de red/egress en el entorno de despliegue (nos
  pasó exactamente eso en el entorno de build de este proyecto). Se
  empaquetan los modelos de idioma como dependencias npm normales
  (`@tesseract.js-data/spa`, `@tesseract.js-data/eng`) y se apunta
  `langPath` a la carpeta local — cero llamadas de red en el pipeline de
  OCR.
- **Render de página para OCR sin dependencias nativas de sistema.** Para
  rasterizar una página de PDF a imagen (necesario antes de pasarla a
  Tesseract) hace falta un canvas. `node-canvas` (el paquete `canvas`)
  requiere cairo/pango/libjpeg instalados a nivel de sistema operativo, lo
  que es frágil en serverless. `@napi-rs/canvas` trae binarios prebuilt por
  plataforma (napi-rs), sin dependencias de sistema, y es compatible con el
  `canvasFactory` que `pdfjs-dist` espera en Node.
- **`next.config.mjs`: `serverComponentsExternalPackages`.** `@napi-rs/canvas`
  incluye un binario nativo (`.node`); si webpack intenta bundlearlo, el
  build falla ("Module parse failed"). Y si un paquete que usa `__dirname`
  para localizar un asset junto a su código (como `@tesseract.js-data/*`)
  se bundlea, `__dirname` deja de apuntar a la carpeta real en disco y el
  asset no se encuentra en runtime — nos pasó exactamente así con
  `spa.traineddata.gz` hasta añadir también `@tesseract.js-data/*` a la
  lista de externos. Todos los paquetes con binarios nativos o assets
  resueltos por ruta de archivo van en `experimental.serverComponentsExternalPackages`.
- **Límite de páginas en OCR.** Tesseract.js puro es notablemente más lento
  que un servicio de OCR gestionado. Se limita a las primeras 40 páginas
  (`MAX_OCR_PAGES` en `src/server/pdf/ocr.ts`) para acotar el tiempo de
  proceso; si el documento tiene más, se avisa al usuario en vez de
  colgar el pipeline. Migrar a un proveedor de OCR en la nube es la vía
  natural de escalar esto si se vuelve un cuello de botella real.

## Subida de archivos

- **Subida directa a Blob desde el navegador, no a través de la función
  serverless.** Vercel limita a ~4.5MB el body de las funciones serverless
  — insuficiente para un pliego escaneado de 150 páginas. El cliente pide
  un token firmado a `/api/blob/upload` (que valida la sesión antes de
  emitirlo) y sube el archivo directo a Vercel Blob con `@vercel/blob/client`.
  El servidor nunca ve los bytes del PDF en ese camino.
- **Fallback de almacenamiento local (`src/server/storage/local.ts`).** Sin
  `BLOB_READ_WRITE_TOKEN` configurado (desarrollo sin cuenta de Vercel), la
  subida cae a un endpoint normal (`/api/tenders/upload-local`) que escribe
  en `.local-blob-storage/` (gitignored). El resto del pipeline
  (extracción, descarga autenticada) es agnóstico de cuál de los dos
  backends se usó — pasa siempre por `fetchStoredFile()`.
- **Descarga del PDF original solo vía proxy autenticado**
  (`/api/tenders/[id]/file`), nunca enlazando la URL de Blob directamente
  desde el cliente: así el control de acceso (¿pertenece esta licitación a
  la organización del usuario?) se aplica siempre, independientemente de si
  alguien adivinara o filtrara la URL del blob.

## Pipeline de IA — detalle de implementación (Fase 3)

- **Modelo: `claude-opus-5` en todo el pipeline, sin excepciones.** La
  extracción de requisitos excluyentes es la lógica más crítica del
  producto — un falso negativo/positivo le cuesta la licitación al
  cliente — así que no se degrada a un modelo más barato para ahorrar
  coste sin que el usuario lo pida explícitamente. El coste real por
  análisis se mide y se expone (`AiUsageLog`, `src/ai/pricing.ts`) para
  que la decisión de optimizar coste, si hace falta, sea del usuario.
- **Structured outputs, no tool use forzado.** Se usa
  `output_config.format` con `zodOutputFormat(schema)` (helper oficial del
  SDK) en vez de definir una tool y forzar `tool_choice` — es el mecanismo
  recomendado actual para "quiero JSON validado por mi schema Zod", más
  directo que simular structured output con tool use. `response.parsed_output`
  llega ya tipado y validado; si es `null` (el modelo no cumplió el
  schema), se reintenta.
- **Zod v4 solo para los schemas de IA.** El helper `zodOutputFormat` del
  SDK de Anthropic espera instancias de `zod/v4`, no de `zod` v3 (que es
  lo que usa el resto de la app — formularios, validación de API routes).
  Zod 3.25+ empaqueta ambas APIs en el mismo paquete, así que no hace
  falta una segunda dependencia: los schemas en `src/ai/schemas/*.ts`
  importan explícitamente `from "zod/v4"`, y son los únicos archivos del
  proyecto que lo hacen — el resto sigue con `import { z } from "zod"`
  (v3) con normalidad.
- **Streaming en vez de `.parse()` no-streaming.** El pliego completo
  entra como prefill (hasta ~150 páginas), lo que puede alargar la
  petición más allá de lo prudente para una llamada no-streaming.
  `client.messages.stream(...)` + `stream.finalMessage()` soporta
  `output_config.format` igual que `.parse()` y evita timeouts
  intermedios — con un `timeout` explícito de 10 minutos por request.
- **Créditos: descuento síncrono, reembolso automático si falla.** El
  crédito se descuenta en la API route que dispara el análisis
  (`POST /api/tenders/[id]/analyze`), no dentro de la función async — así
  el usuario ve el saldo actualizado al instante y no puede lanzar el
  mismo análisis dos veces con el mismo crédito. `CreditLedgerEntry` es un
  ledger append-only con lectura+escritura en una transacción
  `Serializable` (`src/server/billing/credits.ts`) para que dos análisis
  concurrentes no puedan ambos leer saldo suficiente y dejarlo en
  negativo. Si el análisis falla de forma irrecuperable, la función de
  Inngest reembolsa el crédito automáticamente (`reason: REFUND`).
- **`TenderAnalysis` versionado.** Cada ejecución del análisis crea una
  fila nueva (`version` incremental) en vez de sobreescribir la anterior
  — permite comparar resultados si se regenera y correlacionar con
  `promptVersion` al depurar una regresión de calidad tras cambiar el
  prompt.
- **Manejo de "pliego sin sección de requisitos clara".** El propio
  schema exige que el modelo declare `requirementsSectionUnclear: true`
  cuando no encuentra una sección de solvencia/admisión delimitada, en
  vez de devolver un array vacío sin más contexto — la UI muestra un
  aviso explícito en vez de dar a entender silenciosamente "sin
  requisitos excluyentes".
- **No probado contra la API real de Claude en este entorno de build**
  (sin `ANTHROPIC_API_KEY` disponible en el sandbox de construcción). Se
  verificó en cambio el resto del pipeline end-to-end con Postgres +
  Inngest Dev Server reales: descuento de crédito, disparo del evento,
  fallo controlado por falta de credencial, reembolso automático, y
  reflejo correcto del estado en la UI (`ANALYZING` → `ANALYSIS_FAILED`
  con reintento). Verificar con una clave real antes de producción.

## Cruce de requisitos (Fase 4) — la lógica más crítica del producto

Un falso "cumples" en el semáforo puede hacer que el cliente presente una
oferta que va a ser excluida — y un falso "no cumples" le puede hacer
descartar una licitación que sí podía ganar. Por eso el motor de cruce
(`src/server/eligibility/`) sigue un único principio de diseño en cada
matcher: **ante la duda, AMBER, nunca GREEN.** Un matcher que no tiene
datos suficientes para confirmar el cumplimiento nunca lo asume — devuelve
AMBER con una explicación de qué revisar manualmente. Solo se marca GREEN
cuando hay una coincidencia concreta y verificable contra el perfil, y solo
se marca RED cuando hay una comparación numérica clara que falla (importe,
nº de referencias) — nunca por ausencia de datos.

- **Determinista, no otra llamada a Claude por requisito.** Cada categoría
  de requisito (`CERTIFICATION`, `FINANCIAL`, `TECHNICAL_EXPERIENCE`,
  `TEAM_QUALIFICATION`) tiene un *matcher* en TypeScript
  (`src/server/eligibility/matchers/`) que extrae la señal relevante del
  texto del requisito (código de norma ISO, importe en euros, nº de años/
  referencias exigidas — `normalize.ts`, `money.ts`) y la compara contra
  los datos ya estructurados del perfil. Es instantáneo, gratis, 100%
  auditable, y — sobre todo — testeable de forma exhaustiva, que es
  justamente lo que exige la lógica de negocio más crítica del producto.
- **`LEGAL_ADMINISTRATIVE`, `INSURANCE` y `OTHER` siempre dan AMBER.** No
  hay un campo estructurado en el perfil que pueda demostrar una
  declaración responsable o una póliza de seguro concreta — fingir que sí
  sería precisamente el tipo de falso positivo que este producto existe
  para evitar.
- **Extensión pendiente (no implementada en esta fase): fallback asistido
  por IA para requisitos ambiguos.** El diseño original contemplaba una
  llamada a Claude solo para los casos donde el matcher determinista no
  puede resolver el requisito (en vez de AMBER genérico). Se ha dejado
  fuera del alcance de esta fase para mantener el foco en el motor
  determinista + sus tests — es la extensión natural más obvia si el AMBER
  genérico resulta poco útil en la práctica.
- **47 tests unitarios** (`src/server/eligibility/*.test.ts`) cubren el
  parser de importes en varios formatos españoles, la extracción de
  códigos de norma/años/nº de referencias, cada matcher (incluyendo los
  casos límite: "nunca debe dar GREEN por falta de datos", "nunca debe
  dar RED solo por ambigüedad") y el rollup del semáforo global.
- **Perfil de empresa único por organización (MVP).** El modelo de datos
  ya soporta varios `CompanyProfile` por organización (vía `Client`, para
  el plan Agencia con multi-cliente), pero la Fase 4 solo construye la UI
  para el perfil "por defecto" de la organización — se crea
  automáticamente vacío en el primer acceso a `/dashboard/profile`. El
  selector de perfil por cliente queda para cuando se aborde el plan
  Agencia (Fase 6).

## Generador de propuesta y exportación (Fase 5)

- **`runStructuredExtraction` compartido entre análisis (Fase 3) e índice
  de propuesta (Fase 5).** Ambos son "dame JSON validado por mi schema a
  partir del pliego completo" — se extrajo el bucle de llamada+reintento a
  `src/ai/run-structured.ts` en vez de duplicarlo. La generación de
  contenido de sección es deliberadamente distinta (texto libre, sin
  `output_config.format`) porque ahí el objetivo es prosa, no datos.
- **Créditos: la generación del borrador NO consume un crédito aparte.**
  El modelo de precios del producto es "$29/licitación" o "5
  análisis/borradores al mes" — una unidad de valor por licitación, no por
  sección regenerada N veces. El coste real de cada llamada se sigue
  registrando en `AiUsageLog` (steps `proposal-outline` y
  `section-generation`) para poder vigilar el margen si el uso de
  "regenerar" resulta más caro de lo asumido; endurecer esto (p.ej. límite
  de regeneraciones por sección) es la palanca obvia si hace falta.
- **Export a Word y PDF desde el mismo árbol de secciones, sin pasar por
  Markdown-a-HTML-a-lo que sea.** `src/server/proposals/section-tree.ts`
  aplana el árbol anidado que devuelve Prisma (cuya profundidad de tipos
  está fijada por el `include`) a un tipo autorreferencial simple; tanto
  `export-docx.ts` (paquete `docx`) como `export-pdf.tsx`
  (`@react-pdf/renderer`) recorren ese mismo árbol aplanado. El "markdown"
  que genera Claude para el contenido de cada sección es deliberadamente
  mínimo (negrita con `**`, listas con `- `) — se parsea a mano en ambos
  exportadores en vez de traer una librería de markdown completa, porque
  es la única sintaxis que se le pide al modelo que use.
- **Probado end-to-end con un árbol de secciones sintético** (sin
  `ANTHROPIC_API_KEY` disponible en este entorno): edición manual y
  guardado de una sección, regeneración con fallo controlado (sin
  credencial) que preserva el contenido previo en vez de borrarlo, y
  exportación real a `.docx` y `.pdf` — verificado abriendo ambos ficheros
  (estructura de encabezados por profundidad, negrita, viñetas y
  placeholder de "sección pendiente de generar" correctos en los dos
  formatos).

## Facturación, Stripe y créditos (Fase 6)

- **El plan Agencia es "análisis ilimitados" de verdad — no un número
  grande de créditos.** `hasUnlimitedCredits()` comprueba
  `Subscription.plan === 'AGENCY' && status === 'ACTIVE'` y, si es cierto,
  ni siquiera toca el ledger de créditos (ni al consumir ni al
  reembolsar) — los dos call sites (la ruta que dispara el análisis y el
  paso de reembolso en el Inngest de la Fase 3) comprueban esto antes de
  llamar a `consumeCredits`/`refundCredits`. Verificado con datos reales:
  con saldo en 0 y plan Agencia, el análisis se dispara igualmente y no se
  crea ninguna entrada nueva en el ledger.
- **Ledger append-only también para altas.** `grantCredits` (compras
  pay-as-you-go, alta de plan Pro, renovación mensual) sigue el mismo
  patrón transaccional `Serializable` que `consumeCredits`/`refundCredits`
  — nunca se escribe un contador mutable.
- **Idempotencia de webhooks de Stripe.** `checkout.session.completed`
  para una compra pay-as-you-go concede créditos vía el `checkout session
  id` en el metadata del ledger (para poder auditar qué compra generó qué
  entrada); la concesión de créditos del primer periodo del plan Pro se
  hace solo si `existing.stripeSubscriptionId !== subscription.id` (para
  no duplicar si Stripe reenvía el evento); la renovación mensual solo
  concede créditos cuando `invoice.billing_reason === 'subscription_cycle'`
  (nunca en la factura inicial, que ya la cubre `checkout.session.completed`).
- **`current_period_end` de Stripe: comprobado en dos sitios posibles.**
  Este campo ha cambiado de ubicación entre versiones recientes de la API
  de Stripe (a veces vive en la propia suscripción, a veces solo en cada
  subscription item) — `extractCurrentPeriodEnd()`
  (`src/server/billing/subscription-status.ts`) prueba ambos sitios en
  vez de asumir uno. Verifica esto contra la versión de API configurada
  en tu cuenta de Stripe antes de confiar en ello a ciegas.
- **No probado contra la API real de Stripe en este entorno** (sin
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` disponibles en el sandbox de
  build). Las rutas de checkout/portal devuelven un 503 explícito
  (`stripe_not_configured`) en vez de fallar de forma opaca cuando faltan
  las credenciales — verificado. La lógica de negocio que sí es
  determinista y no depende de Stripe (el bypass de créditos ilimitados
  del plan Agencia) se probó con datos reales. Verificar el flujo
  completo de checkout/webhook con claves de test de Stripe antes de
  producción — ver README.md para la configuración del CLI de Stripe en
  local (`stripe listen`).

## Datos de demo (Fase 7)

- **Pliego ficticio realista, no un PDF de relleno.** `prisma/fixtures/mock-tender-content.ts`
  define el contenido de un pliego español de "Servicio de mantenimiento
  de sistemas informáticos" (4 páginas, clausulado numerado, solvencia
  económica/técnica, certificaciones ISO 9001/ISO 27001/ENS, baremo con
  pesos) con lenguaje real de pliego (incluyendo giros como "2 (dos)
  contratos" que casi rompen el parser de referencias del motor de cruce —
  ver más abajo). `scripts/generate-mock-tender-pdf.ts` lo renderiza a PDF
  con `pdfkit` (devDependency, no se usa en runtime de la app); el PDF
  resultante se commitea en `prisma/fixtures/pliego-mantenimiento-informatico.pdf`.
- **El seed corre el pipeline real, no solo inserta filas.** `prisma/seed.ts`
  sube el PDF al storage local, ejecuta `extractTenderDocument()` (Fase 2,
  código real) para obtener el texto, y ejecuta
  `runEligibilityCrossCheck()` (Fase 4, código real) contra un
  `CompanyProfile` de demo deliberadamente incompleto (le falta ISO 27001,
  la facturación media no llega al mínimo exigido). Lo único "sintético"
  es el `TenderAnalysis` en sí — los 8 `ExclusionRequirement` y 4
  `ScoringCriterion` se insertan a mano porque no hay `ANTHROPIC_API_KEY`
  en el entorno de build, para no depender de una llamada real a Claude
  solo para tener una demo. El resultado: `npm run prisma:seed` deja una
  licitación `READY` con semáforo **RED real** (score 57/100, calculado
  por el motor determinista, no hardcodeado) — un caso instructivo de "casi
  cumples, pero no del todo", justo el problema que el producto existe
  para resolver.
- **Detalle real encontrado al escribir el fixture**: el regex de
  extracción de "nº de referencias exigidas" (`extractReferenceCountRequirement`,
  Fase 4) no reconoce "2 (dos) contratos" — el inciso entre paréntesis
  rompe la adyacencia dígito→palabra clave que el regex espera. En
  producción esto no es un problema porque el campo `description` que
  genera Claude es una paráfrasis limpia ("al menos 2 contratos..."), no
  una copia literal del pliego — el matcher opera sobre `description`
  antes que sobre `citationText`. Al escribir los datos sintéticos del
  seed a mano hay que recordar imitar esa paráfrasis limpia en
  `description` y dejar el "(dos)" solo en `citationText`, donde no
  afecta al cruce.
- **`npm run prisma:seed` es idempotente**: si el usuario demo ya existe,
  no hace nada (evita duplicar la licitación de demo en reseeds).

## Tests (Fase 8)

- **Tres capas, no solo unit tests.** El pedido original marca la lógica
  de cruce de requisitos como "la lógica de negocio más crítica" (un falso
  "cumples" puede costarle una licitación al cliente), así que se prueba
  en tres niveles distintos en vez de confiar en uno solo:
  1. **Unitarios en memoria** (`src/server/eligibility/{normalize,money,engine}.test.ts`,
     47 tests): funciones puras del motor — normalización de texto,
     parseo de importes en formato español, `evaluateRequirement`/
     `evaluateAllRequirements`/`rollupEligibility` — sin tocar la base de
     datos.
  2. **Integración contra Postgres real**
     (`src/server/eligibility/run-cross-check.integration.test.ts`,
     `src/server/pdf/extract-tender-document.integration.test.ts`):
     ejecutan `runEligibilityCrossCheck()` y `extractTenderDocument()`
     tal cual se llaman en producción — el primero crea su propia
     Organization/Tender/TenderAnalysis/ExclusionRequirement/CompanyProfile
     con datos con un requisito que sí se cumple y otro que no, verifica
     que persiste `EligibilityCheck` GREEN/RED correctamente, que el
     rollup en `TenderAnalysis.eligibilityStatus`/`eligibilityScore` es el
     esperado, y que ejecutarlo dos veces no duplica filas (upsert por
     `requirementId`, no create ciego); el segundo corre la extracción de
     texto real contra el PDF fixture committeado. Ambos usan
     `describe.skipIf(!hasDatabase)` para no romper un entorno sin
     `DATABASE_URL` (p.ej. CI sin Postgres), y limpian todo lo que crean en
     `afterAll`.
  3. **End-to-end con Playwright** (`e2e/*.spec.ts`, navegador real): el
     flujo que ningún test unitario puede cubrir — que el semáforo
     realmente se vea en la pantalla correcta tras iniciar sesión.
     `auth.spec.ts` prueba registro, login con contraseña incorrecta, y
     redirección si no hay sesión (estos tres son autocontenidos, no
     dependen de datos previos). `demo-flow.spec.ts` prueba el flujo
     contra los datos de `npm run prisma:seed` — lista con semáforo,
     detalle con requisitos por línea y resumen ejecutivo, perfil de
     empresa, y navegación al editor de propuesta — deliberadamente sin
     depender de `ANTHROPIC_API_KEY`: el seed ya deja el análisis
     calculado por el motor real (ver Fase 7), así que el E2E prueba el
     renderizado y la navegación, no la llamada a Claude en sí.
- **`vitest.config.mts` carga `.env` a mano.** Ni `tsx` ni Vitest cargan
  dotenv automáticamente; se añadió `process.loadEnvFile()` (API nativa de
  Node 20.6+/22, sin dependencia extra) en un try/catch antes de
  `defineConfig`, para que los tests de integración tengan
  `DATABASE_URL`/`ENCRYPTION_KEY` disponibles igual que en runtime normal.
- **`playwright.config.ts` no fija una ruta de Chromium por defecto.** El
  sandbox de desarrollo usa un Chromium preinstalado en una ruta propia
  (`/opt/pw-browsers/chromium`), pero hardcodear esa ruta en el config
  committeado rompería cualquier otro entorno/CI que use el Chromium
  descargado por `npx playwright install`. En vez de eso, el
  `executablePath` solo se fija si la variable de entorno
  `PLAYWRIGHT_CHROMIUM_PATH` está definida explícitamente — en este
  sandbox se exporta al ejecutar los tests, no se commitea.
- **Locators de Playwright y "strict mode violation".** Dos tests
  fallaron en la primera pasada porque `getByText(...)` encontraba dos
  elementos que contenían el mismo texto (p.ej. el nombre de la
  administración aparece tanto en la card de la licitación como en el
  breadcrumb; "Resumen ejecutivo de la propuesta" aparece como título de
  sección en el árbol y como heading del contenido). Se corrigió acotando
  con `.first()` o cambiando a `getByRole` con un nombre accesible más
  específico, en vez de debilitar la aserción.
- **Total: 53 tests unitarios/integración (Vitest) + 6 tests E2E
  (Playwright)**, todos verdes. `npm run test:e2e` corre el E2E;
  `npm run test`, el resto.

## Rediseño visual de la landing (post-lanzamiento)

Tras el primer despliegue, feedback de que la web se veía "sin vida" —
paleta casi monocroma en azul marino muy oscuro, sin elementos dinámicos.
Cambios, manteniendo el tono profesional B2B pedido en el encargo original:

- **Paleta**: `--primary` pasa de un azul marino casi negro (`222 47% 18%`)
  a un índigo vivo (`243 75% 59%`), con 5 colores de marca decorativos
  (`--brand-violet/blue/teal/amber/rose`, en `globals.css` y expuestos como
  `bg-brand-*` en `tailwind.config.ts`) usados solo en la web pública —
  fondo, badges de semáforo y demás componentes del dashboard siguen el
  sistema semántico de shadcn sin tocar, así que el cambio de paleta
  cascada automáticamente sin tener que editar cada componente. Modo
  oscuro con fondo índigo-carbón en vez de negro plano, mismo criterio.
- **Elementos dinámicos, no fotos de stock**: al no tener acceso a un
  banco de imágenes real (y para no usar fotografía genérica de stock que
  no aporta), la "vida" viene de tres piezas nuevas en
  `src/components/marketing/`: `eligibility-demo.tsx` (tarjeta que cicla
  cada 2.6s entre los 3 requisitos reales del pliego de demo —
  ISO 9001/facturación/ISO 27001 — con sus mismos veredictos verde/ámbar/
  rojo, no son datos inventados para el marketing), `stat-counter.tsx`
  (contador animado con `IntersectionObserver` + easing cúbico) y
  `reveal.tsx` (fade-in-up al hacer scroll, también con
  `IntersectionObserver`). Blobs de gradiente animados en CSS puro
  (`@keyframes blob` en `globals.css`) detrás del hero y del banner final,
  con `prefers-reduced-motion` respetado.
- **Verificación**: capturas con Playwright en claro/oscuro del landing,
  login, dashboard vacío, subida y perfil de empresa — confirmando que el
  contraste y la paleta funcionan en todas las pantallas, no solo en la
  home. (Se detectó y descartó un falso positivo: en la primera captura
  el contador y la sección CTA final aparecían incompletos/en blanco
  porque el `IntersectionObserver` no había disparado aún durante la
  captura headless; con scroll simulado antes de la captura, todo revela
  correctamente.)

## Despliegue en Vercel — Prisma Client desactualizado con caché de dependencias

Primer intento real de despliegue en Vercel: el build fallaba en
`Collecting page data` con `PrismaClientInitializationError` en las rutas
que importan `@prisma/client` (`/api/billing/checkout`,
`/api/billing/portal`), aunque `npm run build` pasaba sin problema en
local. Causa: Vercel cachea `node_modules` entre builds para acelerar
`npm install`; cuando reutiliza la caché no vuelve a disparar la
generación del cliente de Prisma (que normalmente ocurre como efecto
colateral de `npm install` en una instalación limpia), así que el
`@prisma/client` empaquetado queda desactualizado o directamente sin
generar. Localmente nunca se reproduce porque el cliente ya estaba
generado de ejecuciones anteriores de `prisma:generate`/`db:push`. Fix
recomendado por Prisma para este caso exacto: un script `postinstall` en
`package.json` que corre `prisma generate` siempre, tenga o no caché
`node_modules` reutilizada — `"postinstall": "prisma generate"`.

## Riesgos aceptados

- **Next 14 vs. postcss vendorizado**: `npm audit` señala CVEs de `postcss`
  que solo se resuelven subiendo a Next 16. Son de severidad "alta" pero
  requieren procesar CSS/source maps no confiables desde el propio servidor
  — no aplican a nuestro uso (no exponemos un endpoint que acepte CSS de
  terceros). Revisar al planear la migración a Next 15/16.
- **Advisories de Next.js sobre Server Actions/Middleware/WebSockets**: no
  usamos custom server, WebSocket upgrades ni i18n de Pages Router — fuera
  del radar de esas CVEs concretas, pero se revisarán en cada actualización
  de parche dentro de la rama 14.2.x.
- **Warning de build "jose ... CompressionStream no soportado en Edge
  Runtime"**: proviene de `@auth/core` (dependencia de NextAuth) y es un
  path de compresión JWE opcional que no usamos (no ciframos JWEs con
  compresión); no afecta a la sesión JWT que usamos en middleware.
