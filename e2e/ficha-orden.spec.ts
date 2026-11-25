import { expect, test, type Page } from "@playwright/test";

const ORDEN_TALLER_2 = "30000000-0000-4000-8000-000000000011";
const UUID_URL = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const PASOS = [
  { boton: "Pasar a Diagnóstico", estado: "Diagnóstico" },
  { boton: "Pasar a Esperando aprobación", estado: "Esperando aprobación" },
  { boton: "Pasar a En reparación", estado: "En reparación" },
  { boton: "Pasar a Listo", estado: "Listo" },
  { boton: "Pasar a Entregado", estado: "Entregado" },
];

const botonesDeEstado = (page: Page) => page.getByRole("button", { name: /^Pasar a / });

test.describe.serial("ficha de la orden (criterios 1 a 4)", () => {
  const matricula = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let fichaUrl = "";

  test("criterio 1: se ven los datos y el historial con el evento de creación", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill("Ficha E2E");
    await page.getByLabel("Teléfono").fill("600111222");
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Seat Ibiza");
    await page.getByLabel("Kilómetros").fill("85000");
    await page.getByLabel("Avería que cuenta el cliente").fill("Ruido al frenar");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
    fichaUrl = new URL(page.url()).pathname;

    await expect(page.getByRole("heading", { level: 1 })).toContainText(matricula);
    await expect(page.getByText("Ficha E2E")).toBeVisible();
    await expect(page.getByText("600111222")).toBeVisible();
    await expect(page.getByText("Seat Ibiza")).toBeVisible();
    await expect(page.getByText("85.000 km")).toBeVisible();
    await expect(page.getByText("Ruido al frenar")).toBeVisible();
    await expect(page.getByTestId("estado-actual")).toContainText("Recibido");

    const historial = page.getByRole("region", { name: "Historial" });
    const items = historial.getByRole("listitem");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Orden creada en Recibido");
    await expect(items.first().locator("time")).toHaveAttribute("datetime", /^20\d\d-/);
    await expect(page.getByRole("link", { name: "Volver al tablero" })).toHaveAttribute("href", "/");
  });

  test("criterio 2: desde Recibido solo se ofrece Diagnóstico", async ({ page }) => {
    await page.goto(fichaUrl);
    await expect(botonesDeEstado(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Pasar a Diagnóstico" })).toBeVisible();
  });

  test("criterio 3: cambiar de estado actualiza ficha, historial y tablero", async ({ page }) => {
    await page.goto(fichaUrl);
    await page.getByRole("button", { name: "Pasar a Diagnóstico" }).click();
    await expect(page.getByTestId("estado-actual")).toContainText("Diagnóstico");
    const items = page.getByRole("region", { name: "Historial" }).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("Recibido → Diagnóstico");
    await expect(items.first().locator("time")).toHaveText(/\d{4}/);
    // En Diagnóstico se puede avanzar o retroceder, nada más.
    await expect(botonesDeEstado(page)).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Pasar a Recibido" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pasar a Esperando aprobación" })).toBeVisible();

    // El tablero refleja el cambio: la orden está en la columna Diagnóstico.
    await page.getByRole("link", { name: "Volver al tablero" }).click();
    await page.goto(`/?q=${matricula}`);
    const columna = page.getByRole("region", { name: /^Diagnóstico/ });
    await expect(columna.getByRole("link", { name: new RegExp(matricula) })).toBeVisible();
    await expect(
      page.getByRole("region", { name: /^Recibido/ }).getByRole("link", { name: new RegExp(matricula) }),
    ).toHaveCount(0);
  });

  test("criterio 4: recorre el flujo hasta Entregado, que no ofrece cambios", async ({ page }) => {
    await page.goto(fichaUrl);
    for (const paso of PASOS.slice(1)) {
      await page.getByRole("button", { name: paso.boton }).click();
      await expect(page.getByTestId("estado-actual")).toContainText(paso.estado);
    }
    await expect(botonesDeEstado(page)).toHaveCount(0);
    await expect(page.getByText(/no admite más cambios/)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Historial" }).getByRole("listitem").first(),
    ).toContainText("Listo → Entregado");

    await page.reload();
    await expect(page.getByTestId("estado-actual")).toContainText("Entregado");
    await expect(botonesDeEstado(page)).toHaveCount(0);
  });

  test("360 px sin scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(fichaUrl);
    await expect(page.getByTestId("estado-actual")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
});

test.describe("criterio 5: 404", () => {
  test("una orden del taller 2 da 404 con el usuario 1", async ({ page }) => {
    await page.goto(`/ordenes/${ORDEN_TALLER_2}`);
    await expect(page.getByRole("heading", { name: /404/ })).toBeVisible();
    await expect(page.getByText("Hugo Sanz Alonso")).toHaveCount(0);
    await expect(page.getByText("8888 YYY")).toHaveCount(0);
  });

  test("un id que no es uuid o que no existe da 404", async ({ page }) => {
    for (const id of ["no-es-un-uuid", "30000000-0000-4000-8000-0000000000ff"]) {
      await page.goto(`/ordenes/${id}`);
      await expect(page.getByRole("heading", { name: /404/ })).toBeVisible();
    }
  });
});
