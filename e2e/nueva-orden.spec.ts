import { expect, test, type Page } from "@playwright/test";

const sufijo = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const UUID = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Datos {
  nombre: string;
  telefono: string;
  matricula: string;
  modelo: string;
  km: string;
  averia: string;
}

const datos = (matricula: string, extra: Partial<Datos> = {}): Datos => ({
  nombre: "Cliente E2E",
  telefono: "600111222",
  matricula,
  modelo: "Seat Ibiza",
  km: "85000",
  averia: "Ruido al frenar",
  ...extra,
});

async function rellenar(page: Page, d: Datos) {
  await page.getByLabel("Nombre").fill(d.nombre);
  await page.getByLabel("Teléfono").fill(d.telefono);
  await page.getByLabel("Matrícula").fill(d.matricula);
  await page.getByLabel("Marca y modelo").fill(d.modelo);
  await page.getByLabel("Kilómetros").fill(d.km);
  await page.getByLabel("Avería que cuenta el cliente").fill(d.averia);
}

async function crear(page: Page, d: Datos) {
  await page.goto("/ordenes/nueva");
  await rellenar(page, d);
  await page.getByRole("button", { name: "Crear orden" }).click();
  await expect(page).toHaveURL(UUID, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
}

async function buscar(page: Page, texto: string) {
  await page.goto("/");
  await page.getByLabel("Buscar por matrícula o cliente").fill(texto);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\?q=/);
}

test.describe("nueva orden", () => {
  test("criterios 1, 3 y 4: crea la orden en Recibido y la matrícula se guarda normalizada; la misma matrícula reutiliza cliente y vehículo", async ({ page }) => {
    const s = sufijo();
    const matricula = `E2E${s}`;
    // La tarjeta muestra la matrícula tal cual se escribió (con guion / minúsculas).
    const enTarjeta = new RegExp(`e2e[-\\s]?${s}`, "i");

    // Criterio 1 y 4: matrícula escrita con guion y minúsculas.
    await crear(page, datos(`e2e-${s.toLowerCase()}`, { nombre: "Primero E2E", modelo: "Seat Ibiza", km: "1000" }));

    for (const texto of [matricula, `e2e-${s.toLowerCase()}`, `E2E ${s}`]) {
      await buscar(page, texto);
      const recibido = page.getByRole("region", { name: /^Recibido/ });
      await expect(recibido.getByRole("link", { name: enTarjeta })).toHaveCount(1);
      await expect(recibido.getByText("Primero E2E")).toBeVisible();
    }

    // Criterio 3: misma matrícula escrita distinto, con otro nombre y modelo.
    await crear(page, datos(`E2E ${s}`, { nombre: "Segundo E2E", modelo: "Ford Focus", km: "2000" }));
    await buscar(page, matricula);
    const tarjetas = page.getByRole("region", { name: /^Recibido/ }).getByRole("link", { name: enTarjeta });
    // Dos órdenes, ambas con el mismo cliente actualizado y el mismo vehículo
    // (si se hubieran duplicado, quedaría el nombre/modelo antiguo en alguna).
    await expect(tarjetas).toHaveCount(2);
    for (const t of await tarjetas.all()) {
      await expect(t).toContainText("Segundo E2E");
      await expect(t).toContainText("Ford Focus");
      await expect(t).not.toContainText("Primero E2E");
    }
    await expect(page.getByText("2 órdenes")).toBeVisible();
  });

  test("criterio 2: cada campo vacío o inválido muestra su error junto al campo y conserva lo escrito", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByRole("button", { name: "Crear orden" }).click();
    for (const label of [
      "Nombre",
      "Teléfono",
      "Matrícula",
      "Marca y modelo",
      "Kilómetros",
      "Avería que cuenta el cliente",
    ]) {
      const campo = page.getByLabel(label);
      await expect(campo).toHaveAttribute("aria-invalid", "true");
      const id = await campo.getAttribute("aria-describedby");
      expect(id).toBeTruthy();
      await expect(page.locator(`#${id}`)).toHaveAttribute("role", "alert");
      await expect(page.locator(`#${id}`)).not.toBeEmpty();
    }
    await expect(page).toHaveURL(/\/ordenes\/nueva$/);

    // Inválidos con el resto válido: se conserva todo lo escrito.
    const malos = datos(" - ", { telefono: "12345", km: "-5" });
    await rellenar(page, malos);
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page.getByLabel("Teléfono")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Kilómetros")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Matrícula")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nombre")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nombre")).toHaveValue(malos.nombre);
    await expect(page.getByLabel("Teléfono")).toHaveValue("12345");
    await expect(page.getByLabel("Matrícula")).toHaveValue(" - ");
    await expect(page.getByLabel("Marca y modelo")).toHaveValue(malos.modelo);
    await expect(page.getByLabel("Kilómetros")).toHaveValue("-5");
    await expect(page.getByLabel("Avería que cuenta el cliente")).toHaveValue(malos.averia);
    await expect(page.getByText(/enteros?|número entero/)).toBeVisible();
  });

  test("criterio 5: formulario con labels, solo teclado y 360 px sin scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/ordenes/nueva");
    const sinScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(await sinScroll()).toBe(true);

    // Todos los controles de entrada tienen un nombre accesible (label).
    const sinNombre = await page.evaluate(() =>
      [...document.querySelectorAll("main input:not([type=hidden]), main textarea")].filter(
        (el) => !(el as HTMLInputElement).labels?.length,
      ).length,
    );
    expect(sinNombre).toBe(0);

    const s = sufijo();
    const d = datos(`E2E${s}`, { nombre: "Teclado E2E" });
    await page.getByLabel("Nombre").focus();
    const orden = [d.nombre, d.telefono, d.matricula, d.modelo, d.km, d.averia];
    for (let i = 0; i < orden.length; i++) {
      await page.keyboard.type(orden[i]);
      await page.keyboard.press("Tab");
    }
    await expect(page.getByRole("button", { name: "Crear orden" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(UUID, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
  });
});
