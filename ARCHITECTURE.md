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
2. **Extracción de requisitos excluyentes + criterios de baremo** (Fase 3) —
   tool use de Claude con JSON Schema, validado con Zod; documento completo
   en el contexto (hasta ~150 páginas) con `cache_control` para reutilizarlo
   en los pasos siguientes sin volver a pagar el coste de prefill.
3. **Cruce contra el perfil de empresa** (Fase 4) — lógica determinista en
   TypeScript sobre los datos ya estructurados (no una nueva llamada a
   Claude por requisito), con un fallback asistido por IA solo para
   requisitos ambiguos en texto libre.
4. **Generación del índice de propuesta** (Fase 5) — a partir de la
   estructura exigida por el pliego.
5. **Generación de contenido por sección bajo demanda** (Fase 5) — nunca
   todas las secciones de golpe; cada sección es una llamada independiente
   ("regenerar esta sección") para controlar coste y permitir iteración.

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
