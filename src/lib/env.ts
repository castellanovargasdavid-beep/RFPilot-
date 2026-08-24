import { z } from "zod";

/**
 * Valida las variables de entorno al arrancar el proceso. Falla rápido y con
 * un mensaje claro en vez de dejar que un valor undefined se propague hasta
 * un error críptico en runtime (p.ej. dentro del pipeline de IA).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  DIRECT_DATABASE_URL: z.string().optional(),

  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET es obligatoria"),
  NEXTAUTH_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_ENTRA_ID_CLIENT_ID: z.string().optional(),
  MICROSOFT_ENTRA_ID_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_ENTRA_ID_TENANT_ID: z.string().optional(),

  // AES-256-GCM, 32 bytes en base64 — cifra datos fiscales/financieros en reposo.
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY es obligatoria"),

  ANTHROPIC_API_KEY: z.string().optional(),

  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_AGENCY: z.string().optional(),
  STRIPE_PRICE_PAYG_CREDIT: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "❌ Variables de entorno inválidas:\n" +
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
    );
    throw new Error("Configuración de entorno inválida. Revisa .env — ver .env.example.");
  }
  return parsed.data;
}

export const env = loadEnv();
