import { PrismaClient } from "@prisma/client";

/**
 * Singleton de Prisma Client. En dev, Next.js recarga módulos en cada
 * cambio (HMR) — sin este patrón se abriría una conexión nueva a Postgres
 * en cada guardado de archivo hasta agotar el pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
