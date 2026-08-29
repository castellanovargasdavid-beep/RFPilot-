# Licitium

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
npx prisma migrate deploy   # aplica el historial de migraciones versionadas (prisma/migrations/)
npm run prisma:seed         # crea una organización de demo con datos de ejemplo completos
```

Para cambios de schema durante el desarrollo, usa `npm run prisma:migrate`
(`prisma migrate dev`) — genera una migración versionada nueva en
`prisma/migrations/` y la commitea junto con el cambio de `schema.prisma`.
`npx prisma db push` sigue funcionando para prototipar rápido sin dejar
rastro en el historial, pero no lo uses para cambios que vayan a
desplegarse: divergiría del historial de migraciones que `npm run build`
aplica automáticamente (ver "Despliegue" más abajo).

El seed crea el usuario `demo@licitium.dev` / `demo12345` con una
licitación de ejemplo ya lista (pliego ficticio real de "mantenimiento de
sistemas informáticos", extracción de texto ejecutada de verdad, semáforo
de elegibilidad calculado por el motor real contra un perfil de empresa
deliberadamente incompleto) y un borrador de propuesta parcialmente
redactado — para poder ver el producto completo funcionando sin necesitar
una `ANTHROPIC_API_KEY` ni depender de subir tus propios documentos.

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
| `npm run test` | Tests unitarios e integración (Vitest) |
| `npm run test:watch` | Tests unitarios en modo watch |
| `npm run test:e2e` | Tests end-to-end (Playwright, requiere `npm run dev` y el seed) |
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
  Crea los 3 precios en el Dashboard de Stripe (modo test) — Pro y Agencia
  como precios recurrentes mensuales, Pay-as-you-go como precio único — y
  copia sus IDs (`price_...`). Para probar webhooks en local:
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (te da
  el `STRIPE_WEBHOOK_SECRET` de test al arrancar).

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
6. Planes y facturación con Stripe: checkout (suscripción Pro/Agencia y
   compra de créditos pay-as-you-go), portal de facturación, webhooks
   idempotentes, y plan Agencia con análisis realmente ilimitados (no un
   número grande de créditos).
7. Pulido de UI: skeletons de carga, boundaries de error, notificaciones
   toast en las acciones clave, y un pliego ficticio realista de
   licitación pública española con perfil de empresa y borrador de
   propuesta de ejemplo (`npm run prisma:seed`) para probar el flujo
   completo sin depender de una API key.
8. Tests: 47 tests unitarios sobre el motor de cruce de requisitos, más
   tests de integración contra Postgres real (cruce de requisitos y
   extracción de PDF) y 6 tests end-to-end con Playwright (registro/login,
   y el flujo completo semáforo → requisitos → perfil → borrador de
   propuesta sobre los datos de demo). Ver "Tests (Fase 8)" en
   `ARCHITECTURE.md`.

## Tests

```bash
npm run test          # unitarios + integración (Vitest) — requiere DATABASE_URL
                       # para los de integración; se saltan solos si no está
npm run test:e2e       # end-to-end (Playwright) — requiere `npm run dev`
                       # corriendo en otra terminal y `npm run prisma:seed` ya ejecutado
```

## Despliegue

### Servicios necesarios

| Servicio | Para qué | Dónde crearlo |
|---|---|---|
| PostgreSQL | Base de datos principal | [Neon](https://neon.tech) o [Supabase](https://supabase.com) (plan gratuito válido para empezar) |
| Anthropic (Claude) | Motor de IA del pipeline de análisis y generación de propuestas | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| Vercel Blob | Almacenamiento de los PDFs subidos | Dashboard de Vercel → pestaña Storage → Blob |
| Inngest | Orquestación async del pipeline (extracción → análisis → propuesta) | [inngest.com](https://www.inngest.com) → crea una app, copia Event Key y Signing Key |
| Stripe | Suscripciones (Pro/Agencia), compra de créditos pay-as-you-go, portal de facturación | [dashboard.stripe.com](https://dashboard.stripe.com) (modo test primero) |
| Google / Microsoft OAuth (opcional) | Login social | Google Cloud Console / Azure Entra ID — solo si quieres login social además de email+contraseña |

### Pasos

1. **Base de datos**: crea un proyecto Postgres (Neon/Supabase), copia la
   cadena de conexión pooled a `DATABASE_URL` y la directa (no pooled) a
   `DIRECT_DATABASE_URL`. Las migraciones (`prisma/migrations/`) se
   aplican automáticamente en cada build (ver el paso 7) — no hace falta
   ejecutarlas a mano salvo la primera vez, si tu base de datos ya tenía
   tablas creadas con `db push` (ver aviso en el paso 7).
2. **Claude**: crea una API key en console.anthropic.com y ponla en
   `ANTHROPIC_API_KEY`. El pipeline usa el modelo `claude-opus-5` con
   prompt caching — no requiere configuración adicional en la consola.
3. **Vercel Blob**: en el dashboard del proyecto de Vercel, activa Blob
   Storage y copia el token a `BLOB_READ_WRITE_TOKEN`. Sin esta variable
   la app cae automáticamente al fallback de disco local — **no vale para
   producción** (el filesystem de las funciones serverless no persiste
   entre invocaciones), así que es obligatoria en despliegue real.
4. **Inngest**: crea una app en inngest.com, copia `INNGEST_EVENT_KEY` y
   `INNGEST_SIGNING_KEY`. Tras desplegar, registra el endpoint
   `https://tu-dominio/api/inngest` desde el dashboard de Inngest (o deja
   que el SDK lo sincronice automáticamente si usas la integración de
   Vercel).
5. **Stripe**: crea los 3 precios en el dashboard (Pro y Agencia como
   recurrentes mensuales, pay-as-you-go como precio único) y copia sus IDs
   a `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_PAYG_CREDIT`.
   Copia la clave secreta a `STRIPE_SECRET_KEY`. Configura un webhook
   apuntando a `https://tu-dominio/api/webhooks/stripe` (eventos:
   `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.updated`, `customer.subscription.deleted`) y
   copia su firma a `STRIPE_WEBHOOK_SECRET`. Empieza en modo test, pasa a
   claves live solo cuando el flujo de checkout/portal esté verificado.
6. **Secretos propios**: genera `NEXTAUTH_SECRET` y `ENCRYPTION_KEY` con
   `openssl rand -base64 32` cada uno (deben ser distintos entre sí, y
   distintos de los de desarrollo local). Guarda `ENCRYPTION_KEY` con
   cuidado — cifra CIF/NIF y datos financieros del perfil de empresa; si
   se pierde, esos campos quedan indescifrables.
7. **Desplegar**: conecta el repo a Vercel (o el equivalente), configura
   las variables de entorno anteriores en el proyecto, y despliega. El
   script `build` corre `prisma migrate deploy && next build` — cada
   deploy aplica automáticamente las migraciones pendientes contra
   `DIRECT_DATABASE_URL` antes de compilar, así que un cambio de schema
   nunca llega a producción sin su migración aplicada.

   **Aviso de una sola vez si tu base de datos ya existía antes de este
   cambio** (se gestionó con `prisma db push`, sin historial de
   migraciones — es el caso de cualquier deploy anterior a la migración
   `20260827084750_init`): la primera vez que despliegues con el nuevo
   `build`, `migrate deploy` intentará crear tablas que ya existen y el
   build fallará. Antes de ese deploy, ejecuta una sola vez, contra tu
   base de datos de producción:
   ```bash
   DATABASE_URL="<tu DIRECT_DATABASE_URL de producción>" \
     npx prisma migrate resolve --applied 20260827084750_init
   ```
   Esto marca la migración base como ya aplicada sin volver a ejecutar su
   SQL (las tablas ya existen). A partir de ahí, cada migración nueva se
   aplica normalmente en cada build.
8. **Dominio propio (`www.licitium.es`)**:
   1. En el dashboard de Vercel, entra al proyecto → **Settings → Domains**
      → escribe `www.licitium.es` → **Add**. Añade también `licitium.es`
      (sin `www`) y usa la opción de Vercel para redirigirlo a `www` (o al
      revés, si prefieres que el dominio canónico sea sin `www`).
   2. Vercel te mostrará los registros DNS a crear en el panel de tu
      proveedor de dominio (donde compraste `licitium.es`). Normalmente es
      uno de estos dos casos, y Vercel te dice cuál te toca:
      - **CNAME** para `www` → `cname.vercel-dns.com`.
      - **A** para el dominio raíz (`@`) → `76.76.21.21`.
      Si tu proveedor permite delegar los nameservers a Vercel en vez de
      añadir registros sueltos, esa opción también vale y simplifica los
      renovamientos automáticos de certificado.
   3. Espera a que Vercel marque el dominio como **Valid Configuration**
      (la propagación DNS puede tardar desde minutos hasta unas horas). El
      certificado TLS se emite automáticamente, no hay que subir nada a mano.
   4. Actualiza las variables de entorno de producción en Vercel:
      `NEXTAUTH_URL=https://www.licitium.es` y, si tu código usa una
      variable propia para construir enlaces absolutos (`APP_URL` o
      similar), ponla también a `https://www.licitium.es`.
   5. **Redespliega** después de cambiar esas variables — los cambios de
      entorno no se aplican a builds ya desplegados, hace falta un nuevo
      deploy para que `NEXTAUTH_URL` tenga efecto (login/OAuth y los
      enlaces de los emails transaccionales dependen de ella).
   6. Si usas login social (Google/Microsoft), añade
      `https://www.licitium.es/api/auth/callback/google` (y el
      equivalente de Microsoft) como redirect URI autorizada en la consola
      de cada proveedor OAuth — los callbacks antiguos apuntando al
      dominio `.vercel.app` dejarán de usarse pero no hace falta borrarlos.
9. **Verifica**: crea una cuenta, sube un PDF de prueba, confirma que pasa
   por subiendo → extrayendo → analizando → listo, y que el webhook de
   Stripe concede créditos tras un checkout de test.
