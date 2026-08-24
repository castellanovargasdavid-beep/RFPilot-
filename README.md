# RFPilot

SaaS que analiza pliegos de licitaciones públicas y RFPs corporativos,
evalúa si tu empresa cumple los requisitos excluyentes (semáforo de
elegibilidad) y genera el borrador de la propuesta técnica.

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para las decisiones de diseño y el
pipeline de IA.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL +
Prisma · Auth.js (NextAuth v5) · Claude (Anthropic) · Inngest · Vercel Blob ·
Stripe.

## Setup local

### 1. Requisitos

- Node.js 20+
- PostgreSQL 14+ (local o [Neon](https://neon.tech) en la nube)

### 2. Instalar dependencias

```bash
npm install
```

### 3. Variables de entorno

```bash
cp .env.example .env
```

Rellena como mínimo, para poder arrancar en local:

- `DATABASE_URL` / `DIRECT_DATABASE_URL` — cadena de conexión a tu Postgres.
- `NEXTAUTH_SECRET` — genera con `openssl rand -base64 32`.
- `ENCRYPTION_KEY` — genera con `openssl rand -base64 32` (debe decodificar
  a 32 bytes exactos; cifra datos fiscales/financieros sensibles).

El resto de variables (Anthropic, Stripe, Vercel Blob, Inngest, Google/
Microsoft OAuth) se van necesitando en fases posteriores del pipeline — la
app arranca sin ellas, pero las funcionalidades correspondientes no
funcionarán hasta configurarlas. Ver la sección "Variables de entorno por
servicio" más abajo.

### 4. Base de datos

```bash
npx prisma db push       # aplica el schema (desarrollo)
npx prisma migrate dev   # alternativa con migraciones versionadas
npm run prisma:seed      # crea una organización de demo (demo@rfpilot.dev / demo12345)
```

### 5. Arrancar

```bash
npm run dev
```

En otra terminal, arranca también el Inngest Dev Server (orquesta el
pipeline de extracción/análisis en segundo plano; sin esto, un pliego
subido se queda en estado "Subiendo" para siempre):

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Abre http://localhost:3000. Crea una cuenta desde `/register` (incluye 1
crédito gratis) o usa el usuario de demo del seed.

Sin `BLOB_READ_WRITE_TOKEN` configurada, la subida de PDFs usa
automáticamente un fallback a disco local (`.local-blob-storage/`, ya en
`.gitignore`) — no hace falta cuenta de Vercel para desarrollar en local.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Tests unitarios (Vitest) |
| `npm run test:watch` | Tests unitarios en modo watch |
| `npm run prisma:generate` | Regenera el cliente de Prisma tras tocar el schema |
| `npm run prisma:migrate` | Crea/aplica una migración de desarrollo |
| `npm run db:push` | Sincroniza el schema sin migración (prototipado rápido) |
| `npm run prisma:seed` | Pobla datos de ejemplo |

## Variables de entorno por servicio

Cada bloque se activa a medida que se construye la fase correspondiente
(ver `ARCHITECTURE.md`); de momento solo Auth + DB + cifrado son
imprescindibles para arrancar.

- **Auth OAuth (opcional)**: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
  `MICROSOFT_ENTRA_ID_CLIENT_ID`/`MICROSOFT_ENTRA_ID_CLIENT_SECRET`/
  `MICROSOFT_ENTRA_ID_TENANT_ID`.
- **IA (Fase 3)**: `ANTHROPIC_API_KEY`.
- **Storage (Fase 2)**: `BLOB_READ_WRITE_TOKEN` (Vercel Blob).
- **Colas (Fase 3)**: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **Pagos (Fase 6)**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_PAYG_CREDIT`.

## Estado del proyecto

En construcción por fases (ver commits). Completadas:

1. Esqueleto del proyecto, auth y base de datos.
2. Subida de PDF (drag & drop) + extracción de texto (con fallback OCR
   para pliegos escaneados), procesado async vía Inngest con estados en
   tiempo real (subiendo → extrayendo → listo).
3. Pipeline de análisis IA: semáforo de requisitos excluyentes (con cita
   textual y página/cláusula), criterios de baremo y resumen ejecutivo
   (plazos, presupuesto), con Claude Opus 5 + structured outputs + prompt
   caching del pliego. Consume 1 crédito por análisis, con reembolso
   automático si falla.
4. Perfil de empresa (certificaciones con alerta de caducidad, facturación,
   referencias, equipo) y motor de cruce determinista contra los
   requisitos excluyentes — el semáforo real, con 47 tests unitarios sobre
   la lógica de negocio más crítica del producto.
5. Generador de borrador de propuesta: índice generado por IA según la
   estructura exigida por el pliego, editor en árbol con regeneración por
   sección, y exportación real a Word (.docx) y PDF.
