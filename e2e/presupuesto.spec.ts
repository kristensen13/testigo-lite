import { expect, test, type Page } from "@playwright/test";

const UUID_URL = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function anadir(page: Page, tipo: string, descripcion: string, cantidad: string, precio: string) {
  const form = page.getByRole("form", { name: "Añadir línea" });
  await form.getByLabel("Tipo").selectOption({ label: tipo });
  await form.getByLabel("Descripción").fill(descripcion);
  await form.getByLabel("Cantidad").fill(cantidad);
  await form.getByLabel(/^Precio unitario/).fill(precio);
  await form.getByRole("button", { name: "Añadir línea" }).click();
}

test.describe.serial("presupuesto (criterios 1 a 3)", () => {
  const matricula = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  test("estado vacío en una orden nueva", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill("Presupuesto E2E");
    await page.getByLabel("Teléfono").fill("600111333");
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Renault Clio");
    await page.getByLabel("Kilómetros").fill("12000");
    await page.getByLabel("Avería que cuenta el cliente").fill("Revisión");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL);
    await expect(page.getByText(/Todavía no hay trabajos ni recambios/)).toBeVisible();
    await expect(page.getByTestId("total-presupuesto")).toContainText("0,00");
  });

  test("criterio 1: totales de mano de obra y recambio", async ({ page }) => {
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    await expect(page).toHaveURL(UUID_URL);

    await anadir(page, "Mano de obra", "Cambio de pastillas", "2", "40,00");
    await expect(page.getByTestId("linea")).toHaveCount(1);
    await anadir(page, "Recambio", "Filtro de aire", "1", "25,50");
    await expect(page.getByTestId("linea")).toHaveCount(2);

    await expect(page.getByTestId("total-base")).toHaveText(/105,50/);
    await expect(page.getByTestId("total-iva")).toHaveText(/22,16/);
    await expect(page.getByTestId("total-presupuesto")).toHaveText(/127,66/);
    await expect(page.getByTestId("total-aprobado")).toHaveText(/0,00/);
    await expect(page.getByTestId("decision").first()).toHaveText("Pendiente");
    // El formulario queda vacío tras el alta.
    await expect(page.getByRole("form", { name: "Añadir línea" }).getByLabel("Descripción")).toHaveValue("");
  });

  test("criterio 2: errores junto al campo sin perder lo escrito", async ({ page }) => {
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    const form = page.getByRole("form", { name: "Añadir línea" });

    for (const [cantidad, precio, mensaje] of [
      ["0", "10", /mayor que 0/],
      ["-1", "10", /negativo/],
      ["1,234", "10", /2 decimales/],
      ["1", "0", /mayor que 0/],
      ["1", "-5", /negativo/],
      ["1", "10,999", /2 decimales/],
    ] as const) {
      await anadir(page, "Recambio", "Línea con error", cantidad, precio);
      const campoMalo = cantidad === "1" ? form.getByLabel(/^Precio unitario/) : form.getByLabel("Cantidad");
      await expect(campoMalo).toHaveAccessibleDescription(mensaje);
      await expect(campoMalo).toHaveAttribute("aria-invalid", "true");
      await expect(campoMalo).toHaveAccessibleDescription(/\S/);
      await expect(form.getByRole("alert").first()).toBeVisible();
      await expect(form.getByLabel("Descripción")).toHaveValue("Línea con error");
      await expect(form.getByLabel("Cantidad")).toHaveValue(cantidad);
      await expect(form.getByLabel(/^Precio unitario/)).toHaveValue(precio);
    }
    await expect(page.getByTestId("linea")).toHaveCount(2);
    await expect(page.getByTestId("total-presupuesto")).toHaveText(/127,66/);
  });

  test("criterio 3: editar y borrar líneas pendientes recalcula los totales", async ({ page }) => {
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();

    await page.getByRole("button", { name: "Editar «Filtro de aire»" }).click();
    const edit = page.getByRole("form", { name: "Editar línea «Filtro de aire»" });
    await edit.getByLabel("Cantidad").fill("2");
    await edit.getByLabel(/^Precio unitario/).fill("30");
    await edit.getByRole("button", { name: "Guardar cambios" }).click();
    // 80,00 + 60,00 = 140,00; IVA 29,40; total 169,40
    await expect(page.getByTestId("total-base")).toHaveText(/140,00/);
    await expect(page.getByTestId("total-iva")).toHaveText(/29,40/);
    await expect(page.getByTestId("total-presupuesto")).toHaveText(/169,40/);

    await page.getByRole("button", { name: "Borrar «Cambio de pastillas»" }).click();
    await expect(page.getByTestId("linea")).toHaveCount(1);
    await expect(page.getByTestId("total-base")).toHaveText(/60,00/);
    await expect(page.getByTestId("total-presupuesto")).toHaveText(/72,60/);

    await page.getByRole("button", { name: "Borrar «Filtro de aire»" }).click();
    await expect(page.getByText(/Todavía no hay trabajos ni recambios/)).toBeVisible();
    await expect(page.getByTestId("total-presupuesto")).toHaveText(/0,00/);
  });

  test("360 px sin scroll horizontal con el formulario de edición abierto", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    await anadir(page, "Recambio", "Aceite", "1", "10");
    await page.getByRole("button", { name: "Editar «Aceite»" }).click();
    await expect(page.getByRole("form", { name: "Editar línea «Aceite»" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
});

test("criterio 4: las líneas decididas se muestran bloqueadas, sin botones (solo lectura)", async ({ page }) => {
  await page.goto("/?q=8642");
  await page.getByRole("link", { name: /8642/ }).first().click();
  await expect(page).toHaveURL(UUID_URL);

  const lineas = page.getByTestId("linea");
  await expect(lineas).toHaveCount(3);
  const decididas = lineas.filter({ hasText: "Decidida por el cliente" });
  await expect(decididas).toHaveCount(2);
  await expect(decididas.getByRole("button")).toHaveCount(0);
  await expect(decididas.first().getByTestId("decision")).toHaveText("Aprobada");

  const pendiente = lineas.filter({ hasNotText: "Decidida por el cliente" });
  await expect(pendiente).toHaveCount(1);
  await expect(pendiente.getByRole("button", { name: /^Editar «/ })).toBeVisible();
  await expect(pendiente.getByRole("button", { name: /^Borrar «/ })).toBeVisible();
});
