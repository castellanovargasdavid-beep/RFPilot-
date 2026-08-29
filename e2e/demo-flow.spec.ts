import { test, expect } from "@playwright/test";

/**
 * Flujo completo end-to-end sobre los datos de demo (`npm run prisma:seed`):
 * login → lista de licitaciones con semáforo → detalle con requisitos y
 * resumen ejecutivo → perfil de empresa → borrador de propuesta.
 *
 * No depende de ANTHROPIC_API_KEY: la licitación de demo ya viene con el
 * análisis y el semáforo calculados por el seed contra el motor real
 * (ver prisma/seed.ts). Requiere haber corrido `npm run prisma:seed`
 * contra la base de datos que use este entorno de test.
 */
async function loginAsDemoUser(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@rfpilot.dev");
  await page.getByLabel("Contraseña").fill("demo12345");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test.describe("Flujo completo con datos de demo", () => {
  test("licitación de demo con semáforo, requisitos y resumen ejecutivo", async ({ page }) => {
    await loginAsDemoUser(page);

    await expect(page.getByText("Villaverde de la Sierra")).toBeVisible();
    await expect(page.getByText("No cumples")).toBeVisible();

    await page.getByText("Villaverde de la Sierra").click();
    await expect(page).toHaveURL(/\/dashboard\/tenders\//);

    await expect(page.getByText("Cumples").first()).toBeVisible();
    await expect(page.getByText("No cumples").first()).toBeVisible();
    await expect(page.getByText(/ISO 9001/).first()).toBeVisible();
    await expect(page.getByText(/ISO\/IEC 27001/).first()).toBeVisible();
    await expect(page.getByText("Oferta económica")).toBeVisible();
  });

  test("perfil de empresa de demo con certificaciones, facturación y referencias", async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto("/dashboard/profile");

    await expect(page.getByText("ISO 9001:2015")).toBeVisible();
    await expect(page.getByText("Laura Martín")).toBeVisible();
    await expect(page.getByText("Ayuntamiento de Peñalba").first()).toBeVisible();
  });

  test("borrador de propuesta de demo con árbol de secciones", async ({ page }) => {
    await loginAsDemoUser(page);
    await page.getByText("Villaverde de la Sierra").click();
    await page.getByRole("button", { name: "Generar borrador de propuesta" }).click();

    await expect(page).toHaveURL(/\/proposal$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Resumen ejecutivo de la propuesta" })).toBeVisible();
    await expect(page.getByText("Equipo técnico asignado").first()).toBeVisible();
  });

  test("aviso legal de copiloto auditable visible y confirmación humana de una cita persiste", async ({ page }) => {
    await loginAsDemoUser(page);
    await page.getByText("Villaverde de la Sierra").click();
    await expect(page).toHaveURL(/\/dashboard\/tenders\//);

    // El aviso "no es un dictamen legal" siempre debe estar visible junto al semáforo.
    await expect(page.getByText("Este análisis es una ayuda automatizada, no un dictamen legal.")).toBeVisible();

    const counterText = page.getByText(/confirmados por ti/);
    const initialCount = Number((await counterText.innerText()).match(/(\d+) de 8/)?.[1]);

    const confirmButton = page.getByRole("button", { name: "He verificado esta cita" }).first();
    await confirmButton.click();
    await expect(page.getByRole("button", { name: "Cita revisada por ti" }).first()).toBeVisible({ timeout: 5_000 });
    await expect(counterText).toContainText(`${initialCount + 1} de 8`);

    // Deja el estado como estaba (los tests de este archivo comparten los datos de demo).
    await page.getByRole("button", { name: "Cita revisada por ti" }).first().click();
    await expect(page.getByRole("button", { name: "He verificado esta cita" }).first()).toBeVisible({ timeout: 5_000 });
    await expect(counterText).toContainText(`${initialCount} de 8`);
  });
});

test.describe("Aviso legal", () => {
  test("la página de aviso legal es accesible sin sesión y explica el copiloto auditable", async ({ page }) => {
    await page.goto("/legal/aviso-legal");
    await expect(page.getByRole("heading", { name: "Aviso legal" })).toBeVisible();
    await expect(page.getByText(/no presta asesoramiento jurídico/)).toBeVisible();
  });
});
