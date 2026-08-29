import { test, expect } from "@playwright/test";

test.describe("Registro e inicio de sesión", () => {
  test("un usuario nuevo puede registrarse y llega al dashboard vacío", async ({ page }) => {
    const email = `e2e-${Date.now()}@licitium.test`;

    await page.goto("/register");
    await page.getByLabel("Tu nombre").fill("Usuario E2E");
    await page.getByLabel("Empresa / despacho").fill("E2E Test Consulting");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("password123");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByText("Aún no has analizado ninguna licitación")).toBeVisible();
    await expect(page.getByText("1 crédito")).toBeVisible();
  });

  test("un login con contraseña incorrecta muestra un error y no entra", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@licitium.dev");
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("el dashboard redirige a login si no hay sesión", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
