import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T16. Requiere el seed ampliado (supabase/seed.sql con las órdenes 13 y 14, entregadas
// hace ~45 y ~90 días). Si faltan, el primer test lo dice claramente.
const ANTIGUA_45 = { matricula: "6150 RTM", cliente: "Óscar Valverde Pinto" };
const ANTIGUA_90 = { matricula: "7420 CNP", cliente: "Lucía Escribano Moya" };
const ENTREGADA_RECIENTE = "5566 JKL";
const NO_ENTREGADAS = ["1234 ABC", "2468 HJK", "4321 PQR", "9753 WXY", "3344 FGH"];

const MENSAJE_SEED =
  "Falta el seed de T16: vuelve a ejecutar supabase/seed.sql (órdenes 6150 RTM y 7420 CNP entregadas hace 45 y 90 días).";

const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const tarjeta = (page: Page, matricula: string) => page.getByRole("link", { name: new RegExp(matricula) });
const enlaceAnteriores = (page: Page) => page.getByRole("link", { name: "Ver entregadas anteriores" });

async function sinViolacionesGraves(page: Page, pantalla: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  const graves = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ regla: v.id, impacto: v.impact, ayuda: v.help }));
  expect(graves, `Violaciones graves de accesibilidad en ${pantalla}`).toEqual([]);
}

async function sinScrollHorizontal(page: Page) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(ok).toBe(true);
}

async function irAAnteriores(page: Page) {
  await page.goto("/?entregadas=anteriores");
  await expect(page.getByRole("heading", { level: 2, name: "Entregadas anteriores" })).toBeVisible();
}

test.describe("tablero: entregadas de los últimos 30 días y vista de anteriores", () => {
  test("criterio 1 y 2: el tablero muestra las no entregadas y la entregada reciente, no las antiguas, y ofrece el enlace", async ({ page }) => {
    await page.goto("/");
    for (const matricula of NO_ENTREGADAS) {
      await expect(tarjeta(page, matricula)).toBeVisible();
    }
    const columnaEntregado = page.getByRole("region", { name: /^Entregado/ });
    await expect(columnaEntregado.getByRole("link", { name: new RegExp(ENTREGADA_RECIENTE) })).toBeVisible();

    await expect(page.getByText(ANTIGUA_45.matricula), MENSAJE_SEED).toHaveCount(0);
    await expect(page.getByText(ANTIGUA_90.matricula)).toHaveCount(0);
    // Si el seed no está aplicado el enlace no existe: aquí falla con un mensaje claro.
    await expect(enlaceAnteriores(page), MENSAJE_SEED).toBeVisible();
    const caja = await enlaceAnteriores(page).boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(enlaceAnteriores(page)).toHaveAttribute("href", "/?entregadas=anteriores");
    // Por debajo de los límites no hay aviso de límite.
    await expect(page.getByTestId("aviso-limite")).toHaveCount(0);
  });

  test("criterio 3: la vista de anteriores lista solo las dos antiguas, en orden, con Volver al tablero", async ({ page }) => {
    await page.goto("/");
    await enlaceAnteriores(page).click();
    await expect(page).toHaveURL(/\?entregadas=anteriores$/);
    await expect(page.getByRole("heading", { level: 2, name: "Entregadas anteriores" })).toBeVisible();

    const tarjetas = page.locator('a[href^="/ordenes/"]:not([href="/ordenes/nueva"])');
    await expect(tarjetas, MENSAJE_SEED).toHaveCount(2);
    await expect(tarjetas.nth(0)).toContainText(ANTIGUA_45.matricula);
    await expect(tarjetas.nth(1)).toContainText(ANTIGUA_90.matricula);
    await expect(page.getByText(ENTREGADA_RECIENTE)).toHaveCount(0);
    await expect(page.getByText("1234 ABC")).toHaveCount(0);

    await page.getByRole("link", { name: "Volver al tablero" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(tarjeta(page, "1234 ABC")).toBeVisible();
  });

  test("criterio 3: el buscador filtra la vista de anteriores (matrícula y nombre) y avisa si no hay coincidencias", async ({ page }) => {
    await irAAnteriores(page);
    const buscar = async (texto: string) => {
      await page.getByLabel("Buscar por matrícula o cliente").fill(texto);
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
    };

    await buscar("7420cnp");
    await expect(page).toHaveURL(/entregadas=anteriores/);
    await expect(tarjeta(page, ANTIGUA_90.matricula), MENSAJE_SEED).toBeVisible();
    await expect(page.getByText(ANTIGUA_45.matricula)).toHaveCount(0);

    await buscar("valverde");
    await expect(tarjeta(page, ANTIGUA_45.matricula)).toBeVisible();
    await expect(page.getByText(ANTIGUA_90.matricula)).toHaveCount(0);

    // Una orden reciente existe, pero no entra en esta vista.
    await buscar("5566 JKL");
    await expect(page.getByText(/No hay entregadas anteriores que coincidan con «5566 JKL»/)).toBeVisible();

    // Limpiar la búsqueda vuelve a la lista completa de anteriores.
    await page.getByRole("link", { name: "Limpiar búsqueda" }).click();
    await expect(page).toHaveURL(/\?entregadas=anteriores$/);
    await expect(tarjeta(page, ANTIGUA_45.matricula)).toBeVisible();
    await expect(tarjeta(page, ANTIGUA_90.matricula)).toBeVisible();
  });

  test("el enlace conserva la búsqueda y en el tablero la búsqueda no encuentra las antiguas", async ({ page }) => {
    await page.goto("/?q=valverde");
    await expect(page.getByText(/No hay órdenes que coincidan con «valverde»/), MENSAJE_SEED).toBeVisible();
    await expect(enlaceAnteriores(page)).toHaveAttribute("href", "/?entregadas=anteriores&q=valverde");
    await enlaceAnteriores(page).click();
    await expect(tarjeta(page, ANTIGUA_45.matricula)).toBeVisible();
    await expect(page.getByLabel("Buscar por matrícula o cliente")).toHaveValue("valverde");
  });

  test("valores de entregadas distintos de «anteriores» se ignoran", async ({ page }) => {
    await page.goto("/?entregadas=todas");
    await expect(tarjeta(page, "1234 ABC")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Entregadas anteriores" })).toHaveCount(0);
  });

  test("criterio 8: axe sin violaciones graves en el tablero con el enlace y en la vista de anteriores", async ({ page }) => {
    await page.goto("/");
    await expect(enlaceAnteriores(page), MENSAJE_SEED).toBeVisible();
    await sinViolacionesGraves(page, "tablero con enlace a anteriores");

    await irAAnteriores(page);
    await expect(tarjeta(page, ANTIGUA_45.matricula)).toBeVisible();
    await sinViolacionesGraves(page, "vista de entregadas anteriores");

    await page.goto("/?entregadas=anteriores&q=zzzinexistente");
    await expect(page.getByText(/No hay entregadas anteriores que coincidan/)).toBeVisible();
    await sinViolacionesGraves(page, "vista de anteriores sin resultados");
  });

  test("criterio 8: 360 px sin scroll horizontal en el tablero y en la vista de anteriores", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await expect(enlaceAnteriores(page), MENSAJE_SEED).toBeVisible();
    await sinScrollHorizontal(page);

    await irAAnteriores(page);
    await expect(tarjeta(page, ANTIGUA_90.matricula)).toBeVisible();
    await sinScrollHorizontal(page);
    const volver = await page.getByRole("link", { name: "Volver al tablero" }).boundingBox();
    expect(volver?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("criterio 2 y 8: el enlace y la vista de anteriores se usan solo con teclado", async ({ page }) => {
    await page.goto("/");
    const enlace = enlaceAnteriores(page);
    await expect(enlace, MENSAJE_SEED).toBeVisible();

    let enfocado = false;
    for (let i = 0; i < 60 && !enfocado; i++) {
      await page.keyboard.press("Tab");
      enfocado = await enlace.evaluate((el) => el === document.activeElement);
    }
    expect(enfocado).toBe(true);
    const outline = await enlace.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?entregadas=anteriores$/);

    // En la vista de anteriores se llega a «Volver al tablero» con Tab y se vuelve con Enter.
    const volver = page.getByRole("link", { name: "Volver al tablero" });
    let enVolver = false;
    for (let i = 0; i < 60 && !enVolver; i++) {
      await page.keyboard.press("Tab");
      enVolver = await volver.evaluate((el) => el === document.activeElement);
    }
    expect(enVolver).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
  });
});
