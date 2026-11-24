import { expect, test, type Page } from "@playwright/test";

// Matrículas del seed (supabase/seed.sql): una por estado del taller 1.
const POR_ESTADO: Record<string, string> = {
  Recibido: "1234 ABC",
  Diagnóstico: "2468 HJK",
  "Esperando aprobación": "4321 PQR",
  "En reparación": "9753 WXY",
  Listo: "3344 FGH",
  Entregado: "5566 JKL",
};

const tarjeta = (page: Page, matricula: string) =>
  page.getByRole("link", { name: new RegExp(matricula) });

async function buscar(page: Page, texto: string) {
  await page.getByLabel("Buscar por matrícula o cliente").fill(texto);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
}

test.describe("tablero", () => {
  test("criterio 1: órdenes de los 6 estados del taller 1 y ninguna del taller 2", async ({ page }) => {
    await page.goto("/");
    for (const [estado, matricula] of Object.entries(POR_ESTADO)) {
      const columna = page.getByRole("region", { name: new RegExp(`^${estado}`) });
      await expect(columna.getByRole("link", { name: new RegExp(matricula) })).toBeVisible();
    }
    await expect(page.getByText("9999 ZZZ")).toHaveCount(0);
    await expect(page.getByText("8888 YYY")).toHaveCount(0);
  });

  test("criterio 2: 1234abc, 1234 ABC y 1234-abc encuentran la misma orden", async ({ page }) => {
    for (const texto of ["1234abc", "1234 ABC", "1234-abc"]) {
      await page.goto("/");
      await buscar(page, texto);
      await expect(page).toHaveURL(/\?q=/);
      await expect(page.getByRole("link", { name: /1234 ABC/ })).toHaveCount(1);
      await expect(page.locator('a[href^="/ordenes/"]:not([href="/ordenes/nueva"])')).toHaveCount(1);
      await expect(page.getByText("Marta Gómez Ruiz")).toBeVisible();
    }
  });

  test("criterio 3: buscar parte del nombre filtra sin distinguir mayúsculas", async ({ page }) => {
    await page.goto("/");
    await buscar(page, "MARTA");
    await expect(page.getByText("Marta Gómez Ruiz")).toBeVisible();
    await expect(tarjeta(page, "5678 DFG")).toHaveCount(0);
    await buscar(page, "marta");
    await expect(page.getByText("Marta Gómez Ruiz")).toBeVisible();
    await expect(tarjeta(page, "5678 DFG")).toHaveCount(0);
  });

  test("los comodines de la búsqueda se tratan como texto literal", async ({ page }) => {
    await page.goto("/");
    await buscar(page, "%");
    await expect(page.getByText(/No hay órdenes que coincidan/)).toBeVisible();
    await buscar(page, "_");
    await expect(page.getByText(/No hay órdenes que coincidan/)).toBeVisible();
  });

  test("criterio 4: búsqueda sin resultados muestra mensaje y acción para limpiar", async ({ page }) => {
    await page.goto("/");
    await buscar(page, "zzzzinexistente");
    await expect(page.getByText(/No hay órdenes que coincidan con «zzzzinexistente»/)).toBeVisible();
    await page.getByRole("link", { name: "Limpiar búsqueda" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(tarjeta(page, "1234 ABC")).toBeVisible();
    await expect(page.getByLabel("Buscar por matrícula o cliente")).toHaveValue("");
  });

  test("criterio 5: cada tarjeta enlaza a su ficha y se opera con teclado", async ({ page }) => {
    await page.goto("/");
    const enlace = tarjeta(page, "1234 ABC");
    await expect(enlace).toHaveAttribute("href", /^\/ordenes\/[0-9a-f-]{36}$/);

    let enfocado = false;
    for (let i = 0; i < 40 && !enfocado; i++) {
      await page.keyboard.press("Tab");
      enfocado = await enlace.evaluate((el) => el === document.activeElement);
    }
    expect(enfocado).toBe(true);
    const outline = await enlace.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ordenes\/[0-9a-f-]{36}$/);
  });

  test("criterio 6 (resultado): el chip x/y aparece en la orden con líneas decididas", async ({ page }) => {
    await page.goto("/");
    await expect(tarjeta(page, "8642 STV")).toContainText("Cliente: 2/3 decididos");
    // Sin ninguna línea decidida no hay chip.
    await expect(tarjeta(page, "4321 PQR")).not.toContainText("decididos");
  });

  test("enlace Nueva orden y 360 px sin scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await expect(tarjeta(page, "1234 ABC")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva orden" })).toHaveAttribute("href", "/ordenes/nueva");
    const sinScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(sinScroll).toBe(true);
  });
});
