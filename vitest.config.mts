import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Los tests de integración que tocan la base de datos necesitan las
// mismas variables que el resto de la app (DATABASE_URL, ENCRYPTION_KEY);
// a diferencia de Next.js, Vitest no carga .env automáticamente.
try {
  process.loadEnvFile(path.resolve(dirname, ".env"));
} catch {
  // Sin .env local (CI con variables ya inyectadas, por ejemplo) — seguimos.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
