import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const UUID_URL = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_URL = /\/p\/([0-9a-f]{64})$/;

/** Llama a la RPC pública portal_get con la clave anónima (sin sesión). */
async function portalGet(request: APIRequestContext, token: string): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await request.post(`${base}/rest/v1/rpc/portal_get`, {
    headers: { apikey: key ?? "", Authorization: `Bearer ${key ?? ""}`, "Content-Type": "application/json" },
    data: { p_token: token },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

async function leerToken(page: Page): Promise<string> {
  const url = (await page.getByTestId("url-cliente").innerText()).trim();
  const m = TOKEN_URL.exec(url);
  expect(m, "la URL debe terminar en /p/<token de 64 hex>").not.toBeNull();
  return m![1];
}

test.describe.serial("enlace para el cliente (criterios 1 a 5)", () => {
  const matricula = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let token1 = "";
  let token2 = "";

  test("criterio 1: crear el enlace muestra la URL y WhatsApp", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill("Lucía Enlace");
    await page.getByLabel("Teléfono").fill("600111444");
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Ford Focus");
    await page.getByLabel("Kilómetros").fill("50000");
    await page.getByLabel("Avería que cuenta el cliente").fill("Revisión de enlace");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL);

    const seccion = page.getByRole("region", { name: "Enlace para el cliente" });
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Sin enlace todavía/);
    await seccion.getByRole("button", { name: "Enlace para el cliente" }).click();

    await expect(page.getByTestId("url-cliente")).toBeVisible();
    token1 = await leerToken(page);
    const wa = seccion.getByRole("link", { name: "Compartir por WhatsApp" });
    const href = await wa.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/34600111444\?text=/);
    const texto = decodeURIComponent(href!.split("?text=")[1]);
    expect(texto).toContain("Hola Lucía");
    expect(texto).toContain(`(${matricula})`);
    expect(texto).toContain(`/p/${token1}`);
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Enlace activo hasta/);

    const datos = (await portalGet(page.request, token1)) as { vehicle: { plate: string } } | null;
    expect(datos?.vehicle.plate).toBe(matricula);
  });

  test("criterio 2: al recargar solo se ve el estado, nunca el token", async ({ page, context }) => {
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    await expect(page).toHaveURL(UUID_URL);
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Enlace activo hasta .+/);
    await expect(page.getByTestId("url-cliente")).toHaveCount(0);
    const html = await (await context.request.get(page.url())).text();
    expect(html).not.toContain(token1);
    expect(await page.content()).not.toContain(token1);
  });

  test("criterio 5: botones con nombre accesible, 44 px y uso con teclado; 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    const seccion = page.getByRole("region", { name: "Enlace para el cliente" });
    const revocar = seccion.getByRole("button", { name: "Revocar enlace" });
    const nuevo = seccion.getByRole("button", { name: "Generar enlace nuevo" });
    for (const b of [revocar, nuevo]) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // Con teclado: foco en "Generar enlace nuevo" y Enter.
    await nuevo.focus();
    await expect(nuevo).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("url-cliente")).toBeVisible();
    token2 = await leerToken(page);
    expect(token2).not.toBe(token1);

    const copiar = seccion.getByRole("button", { name: "Copiar enlace" });
    await copiar.focus();
    await page.keyboard.press("Enter");
    await expect(seccion.getByRole("status").filter({ hasText: /copiado|No se pudo copiar/ })).toBeVisible();
    await expect(seccion.getByRole("link", { name: "Compartir por WhatsApp" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });

  test("criterio 4: generar uno nuevo invalida el anterior y deja uno activo", async ({ page }) => {
    expect(await portalGet(page.request, token1)).toBeNull();
    expect(await portalGet(page.request, token2)).not.toBeNull();
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Enlace activo hasta/);
    const historial = page.getByRole("region", { name: "Historial" });
    await expect(historial.getByRole("listitem").filter({ hasText: /Enlace para el cliente creado/ })).toHaveCount(2);
  });

  test("criterio 3: revocar cambia el estado y el token deja de dar acceso", async ({ page }) => {
    await page.goto(`/?q=${matricula}`);
    await page.getByRole("link", { name: new RegExp(matricula) }).first().click();
    expect(await portalGet(page.request, token2)).not.toBeNull();
    const seccion = page.getByRole("region", { name: "Enlace para el cliente" });
    await seccion.getByRole("button", { name: "Revocar enlace" }).click();
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Enlace revocado/);
    await expect(seccion.getByRole("button", { name: "Revocar enlace" })).toHaveCount(0);
    expect(await portalGet(page.request, token2)).toBeNull();
    await page.reload();
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Enlace revocado/);
  });
});
