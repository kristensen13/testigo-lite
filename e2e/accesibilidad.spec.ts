import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  contextoCliente,
  crearOrdenConTrabajos,
  generarEnlace,
  matriculaE2E,
  pasarAEsperandoAprobacion,
} from "./helpers";

// Reglas WCAG 2.0/2.1/2.2 A y AA. Criterio: cero violaciones `serious` o `critical`.
const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function revisar(page: Page, pantalla: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const resumen = graves.map((v) => ({
    regla: v.id,
    impacto: v.impact,
    ayuda: v.help,
    nodos: v.nodes.slice(0, 5).map((n) => ({ destino: n.target, resumen: n.failureSummary })),
  }));
  expect(resumen, `Violaciones graves de accesibilidad en ${pantalla}`).toEqual([]);
}

// Una única orden E2E para toda la suite: con trabajos pendientes, en Esperando aprobación y con enlace.
test.describe.serial("accesibilidad con axe (WCAG 2 A/AA)", () => {
  let token = "";
  let ctxCliente: BrowserContext;

  test.beforeAll(async ({ browser, baseURL }) => {
    ctxCliente = await contextoCliente(browser, baseURL);
  });

  test.afterAll(async () => {
    await ctxCliente.close();
  });

  test("login", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await revisar(page, "login");
    // Con el error de credenciales ya visible (mensaje en castellano) tampoco hay violaciones.
    await page.getByLabel("Email").fill("nadie@ejemplo.com");
    await page.getByLabel("Contraseña").fill("incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 30_000 });
    await revisar(page, "login con error");
    await ctx.close();
  });

  test("ficha de la orden con presupuesto y enlace visibles, y tablero", async ({ page }) => {
    const matricula = matriculaE2E();
    await crearOrdenConTrabajos(
      page,
      {
        nombre: "Ana Accesible",
        telefono: "600 987 654",
        matricula,
        modelo: "Seat León",
        km: "45000",
        averia: "Revisión de accesibilidad",
      },
      [
        { tipo: "Mano de obra", descripcion: "Cambio de pastillas", cantidad: "2", precio: "40,00" },
        { tipo: "Recambio", descripcion: "Filtro de aire", cantidad: "1", precio: "25,50" },
      ],
    );
    await pasarAEsperandoAprobacion(page);
    token = await generarEnlace(page);
    await expect(page.getByTestId("url-cliente")).toBeVisible();
    await revisar(page, "ficha de la orden");

    await page.goto(`/?q=${matricula}`);
    await expect(page.getByRole("link", { name: new RegExp(matricula) })).toHaveCount(1);
    await revisar(page, "tablero");

    await page.goto("/ordenes/nueva");
    await expect(page.getByRole("button", { name: "Crear orden" })).toBeVisible();
    await revisar(page, "nueva orden");
  });

  test("portal del cliente a 360 px, con botones de decisión y con la confirmación abierta", async () => {
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const portal = await ctxCliente.newPage();
    await portal.goto(`/p/${token}`);
    await expect(portal.getByRole("button", { name: /^Aprobar/ }).first()).toBeVisible();
    await revisar(portal, "portal del cliente (360 px)");

    await portal.getByRole("button", { name: /^Aprobar/ }).first().click();
    await expect(portal.getByTestId("portal-confirmacion")).toBeVisible();
    await revisar(portal, "portal del cliente con confirmación");
    await portal.getByRole("button", { name: "Volver" }).click();

    await portal.goto(`/p/${"ef".repeat(32)}`);
    await expect(portal.getByRole("heading", { level: 1 })).toBeVisible();
    await revisar(portal, "portal con enlace no disponible");
  });

  test("página 404", async ({ page }) => {
    await page.goto("/esta-ruta-no-existe");
    await expect(page.getByRole("heading", { level: 1, name: "404 · Página no encontrada" })).toBeVisible();
    await revisar(page, "404");
  });
});
