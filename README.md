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

Abre http://localhost:3000. Crea una cuenta desde `/register` (incluye 1
crédito gratis) o usa el usuario de demo del seed.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
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

En construcción por fases (ver commits). Fase actual: **1 — esqueleto del
proyecto, auth y base de datos**.
