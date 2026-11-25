import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

const UUID_URL = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_URL = /\/p\/([0-9a-f]{64})$/;
const FECHA = /\d{4}.*\d{2}:\d{2}/; // "5 ene 2030, 09:30"

const A = "Cambio de pastillas"; // 2 h x 40,00 -> 96,80 € con IVA
const B = "Filtro de aire"; // 1 x 25,50 -> 30,86 € con IVA
const C = "Líquido de frenos"; // 1 x 10,00 -> 12,10 € con IVA
const D = "Revisión de niveles"; // 1 x 5,00 -> 6,05 € con IVA

/** Cliente sin sesión del taller y con viewport de móvil (360 px). */
async function contextoCliente(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    viewport: { width: 360, height: 740 },
    storageState: { cookies: [], origins: [] },
  });
}

async function anadirLinea(page: Page, tipo: string, descripcion: string, cantidad: string, precio: string) {
  const form = page.getByRole("form", { name: "Añadir línea" });
  await form.getByLabel("Tipo").selectOption({ label: tipo });
  await form.getByLabel("Descripción").fill(descripcion);
  await form.getByLabel("Cantidad").fill(cantidad);
  await form.getByLabel(/^Precio unitario/).fill(precio);
  await form.getByRole("button", { name: "Añadir línea" }).click();
}

const linea = (page: Page, descripcion: string) =>
  page.getByTestId("portal-linea").filter({ hasText: descripcion });

const sinScrollHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Llama a una RPC pública con la clave anónima del entorno (sin imprimirla). */
async function rpc(request: APIRequestContext, fn: string, data: Record<string, unknown>) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return request.post(`${base}/rest/v1/rpc/${fn}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    data,
  });
}

test.describe.serial("portal: aprobar y rechazar con confirmación (T13)", () => {
  const matricula = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let orderUrl = "";
  let token = "";
  let portal: Page;
  let ctx: BrowserContext;

  test.beforeAll(async ({ browser, baseURL }) => {
    ctx = await contextoCliente(browser, baseURL);
    portal = await ctx.newPage();
  });

  test.afterAll(async () => {
    await ctx.close();
  });

  test("preparación: orden con tres trabajos, en Esperando aprobación y con enlace", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill("Marcos Decisión");
    await page.getByLabel("Teléfono").fill("600222333");
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Renault Clio");
    await page.getByLabel("Kilómetros").fill("88000");
    await page.getByLabel("Avería que cuenta el cliente").fill("Frenos blandos");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
    orderUrl = page.url();

    await anadirLinea(page, "Mano de obra", A, "2", "40,00");
    await expect(page.getByTestId("linea")).toHaveCount(1);
    await anadirLinea(page, "Recambio", B, "1", "25,50");
    await expect(page.getByTestId("linea")).toHaveCount(2);
    await anadirLinea(page, "Recambio", C, "1", "10,00");
    await expect(page.getByTestId("linea")).toHaveCount(3);

    await page.getByRole("button", { name: "Pasar a Diagnóstico" }).click();
    await expect(page.getByRole("button", { name: "Pasar a Esperando aprobación" })).toBeVisible();
    await page.getByRole("button", { name: "Pasar a Esperando aprobación" }).click();
    await expect(page.getByTestId("estado-actual")).toContainText("Esperando aprobación");

    const seccion = page.getByRole("region", { name: "Enlace para el cliente" });
    await seccion.getByRole("button", { name: "Enlace para el cliente" }).click();
    await expect(page.getByTestId("url-cliente")).toBeVisible();
    const m = TOKEN_URL.exec((await page.getByTestId("url-cliente").innerText()).trim());
    expect(m, "la URL debe acabar en /p/<64 hex>").not.toBeNull();
    token = m![1];
  });

  test("criterio 1: Volver cancela sin guardar; confirmar aprueba A y rechaza B", async () => {
    await portal.goto(`/p/${token}`);
    await expect(portal.getByTestId("portal-estado")).toHaveText("Necesitamos tu OK");
    await expect(portal.getByRole("button", { name: /^Aprobar/ })).toHaveCount(3);
    await expect(portal.getByRole("button", { name: /^Rechazar/ })).toHaveCount(3);
    expect(await sinScrollHorizontal(portal)).toBe(true);

    // Pulsar NO guarda: abre la confirmación explícita con el importe con IVA.
    const lineaA = linea(portal, A);
    await lineaA.getByRole("button", { name: /^Aprobar/ }).click();
    const panel = lineaA.getByTestId("portal-confirmacion");
    await expect(panel).toContainText(`¿Apruebas «${A}» por 96,80`);
    await expect(panel).toContainText("IVA incluido");
    const confirmar = panel.getByRole("button", { name: "Sí, apruébalo" });
    await expect(confirmar).toBeFocused();
    expect((await confirmar.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect((await panel.getByRole("button", { name: "Volver" }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await sinScrollHorizontal(portal)).toBe(true);

    // Volver: no guarda y devuelve el foco al botón que abrió el panel.
    await panel.getByRole("button", { name: "Volver" }).click();
    await expect(panel).toHaveCount(0);
    await expect(lineaA.getByRole("button", { name: /^Aprobar/ })).toBeFocused();
    await expect(lineaA.getByTestId("portal-decision")).toContainText("Pendiente");
    await portal.reload();
    await expect(linea(portal, A).getByTestId("portal-decision")).toContainText("Pendiente");
    await expect(portal.getByRole("button", { name: /^Aprobar/ })).toHaveCount(3);
    await expect(portal.getByTestId("portal-total-aprobado")).toHaveText(/0,00/);

    // Aprobar A.
    await linea(portal, A).getByRole("button", { name: /^Aprobar/ }).click();
    await linea(portal, A).getByRole("button", { name: "Sí, apruébalo" }).click();
    await expect(linea(portal, A).getByTestId("portal-decision")).toContainText(/Aprobado el/);

    // Rechazar B: texto propio de la confirmación.
    await linea(portal, B).getByRole("button", { name: /^Rechazar/ }).click();
    await expect(linea(portal, B).getByTestId("portal-confirmacion")).toContainText(`¿Rechazas «${B}» por 30,86`);
    await linea(portal, B).getByRole("button", { name: "Sí, recházalo" }).click();
    await expect(linea(portal, B).getByTestId("portal-decision")).toContainText(/Rechazado el/);
  });

  test("criterios 2, 3 y 4: fecha y hora, sin botones, persiste y es definitiva; total aprobado", async ({ request }) => {
    // Criterio 2: sin recargar, ya con fecha/hora y sin botones; C conserva los suyos.
    const dA = linea(portal, A).getByTestId("portal-decision");
    const dB = linea(portal, B).getByTestId("portal-decision");
    await expect(dA).toHaveText(new RegExp(`Aprobado el .*${FECHA.source}`));
    await expect(dB).toHaveText(new RegExp(`Rechazado el .*${FECHA.source}`));
    await expect(linea(portal, A).getByRole("button")).toHaveCount(0);
    await expect(linea(portal, B).getByRole("button")).toHaveCount(0);
    await expect(linea(portal, C).getByRole("button", { name: /^Aprobar/ })).toBeVisible();

    // Criterio 4: el total aprobado solo suma A (80,00 + 21 % = 96,80); el del presupuesto suma las tres.
    await expect(portal.getByTestId("portal-total-aprobado")).toHaveText(/96,80/);
    await expect(portal.getByTestId("portal-total")).toHaveText(/139,76/);

    // Criterio 3: al recargar persiste y no hay botones en las decididas.
    await portal.reload();
    await expect(linea(portal, A).getByTestId("portal-decision")).toHaveText(/Aprobado el/);
    await expect(linea(portal, B).getByTestId("portal-decision")).toHaveText(/Rechazado el/);
    await expect(linea(portal, A).getByRole("button")).toHaveCount(0);
    await expect(linea(portal, B).getByRole("button")).toHaveCount(0);
    await expect(portal.getByRole("button", { name: /^Aprobar/ })).toHaveCount(1);
    await expect(portal.getByTestId("portal-total-aprobado")).toHaveText(/96,80/);

    // Definitiva también para quien llame a la RPC pública directamente.
    const get = await rpc(request, "portal_get", { p_token: token });
    const datos = (await get.json()) as { lines: { id: string; description: string }[] };
    const idA = datos.lines.find((l) => l.description === A)!.id;
    for (const decision of ["rechazada", "aprobada"]) {
      const r = await rpc(request, "portal_decide", { p_token: token, p_line_id: idA, p_decision: decision });
      expect(r.ok()).toBe(false);
      expect(((await r.json()) as { message: string }).message).toBe("linea_ya_decidida");
    }
    await portal.reload();
    await expect(linea(portal, A).getByTestId("portal-decision")).toHaveText(/Aprobado el/);
  });

  test("criterio 5: el taller ve el chip 2/3, las decisiones con fecha y los eventos del cliente", async ({ page }) => {
    await page.goto(`/?q=${matricula}`);
    const tarjeta = page.getByRole("link", { name: new RegExp(matricula) });
    await expect(tarjeta).toHaveCount(1);
    await expect(tarjeta).toContainText("Cliente: 2/3 decididos");

    await tarjeta.click();
    await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
    const lineas = page.getByTestId("linea");
    const fichaA = lineas.filter({ hasText: A });
    const fichaB = lineas.filter({ hasText: B });
    const fichaC = lineas.filter({ hasText: C });
    await expect(fichaA.getByTestId("decision")).toHaveText("Aprobada");
    await expect(fichaB.getByTestId("decision")).toHaveText("Rechazada");
    await expect(fichaC.getByTestId("decision")).toHaveText("Pendiente");
    await expect(fichaA).toContainText(new RegExp(`Decidida por el cliente el .*${FECHA.source}`));
    await expect(fichaB).toContainText(new RegExp(`Decidida por el cliente el .*${FECHA.source}`));
    await expect(fichaC).not.toContainText("Decidida por el cliente");
    await expect(page.getByTestId("total-aprobado")).toHaveText(/96,80/);

    const historial = page.getByRole("region", { name: "Historial" });
    const evA = historial.getByRole("listitem").filter({ hasText: `El cliente aprobó «${A}»` });
    const evB = historial.getByRole("listitem").filter({ hasText: `El cliente rechazó «${B}»` });
    await expect(evA).toHaveCount(1);
    await expect(evB).toHaveCount(1);
    await expect(evA).toContainText("Cliente");
    await expect(evA.locator("time")).toHaveText(FECHA);
  });

  test("criterio 7: un error de red o de servidor se muestra en la tarjeta y se puede reintentar", async ({ page }) => {
    // Un cuarto trabajo, pendiente hasta el final, para el criterio 6.
    await page.goto(orderUrl);
    await anadirLinea(page, "Mano de obra", D, "1", "5,00");
    await expect(page.getByTestId("linea")).toHaveCount(4);

    await portal.goto(`/p/${token}`);
    let modo: "500" | "red" | "pasa" = "500";
    let interceptadas = 0;
    await portal.route("**/p/*", async (route) => {
      const req = route.request();
      if (req.method() !== "POST" || !req.headers()["next-action"] || modo === "pasa") return route.continue();
      interceptadas++;
      if (modo === "500") return route.fulfill({ status: 500, contentType: "text/plain", body: "fallo del servidor" });
      return route.abort("connectionfailed");
    });

    const lineaC = linea(portal, C);
    await lineaC.getByRole("button", { name: /^Aprobar/ }).click();
    const panel = lineaC.getByTestId("portal-confirmacion");
    const confirmar = panel.getByRole("button", { name: "Sí, apruébalo" });

    // Error de servidor (500): mensaje en castellano dentro de la tarjeta; la confirmación sigue.
    await confirmar.click();
    await expect(lineaC.getByRole("alert")).toHaveText("No hemos podido guardar tu respuesta. Inténtalo de nuevo");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(`¿Apruebas «${C}» por 12,10`);
    await expect(confirmar).toBeEnabled();
    await expect(lineaC.getByTestId("portal-decision")).toContainText("Pendiente");

    // Error de red (petición abortada): mismo comportamiento.
    modo = "red";
    await confirmar.click();
    await expect(lineaC.getByRole("alert")).toHaveText(/No hemos podido guardar tu respuesta/);
    await expect(panel).toBeVisible();
    expect(interceptadas).toBeGreaterThanOrEqual(2);
    expect(await sinScrollHorizontal(portal)).toBe(true);

    // Sin la interceptación, reintentar desde el mismo panel funciona.
    modo = "pasa";
    await portal.unroute("**/p/*");
    await confirmar.click();
    await expect(lineaC.getByTestId("portal-decision")).toHaveText(/Aprobado el/);
    await expect(lineaC.getByRole("button")).toHaveCount(0);
    await expect(portal.getByTestId("portal-total-aprobado")).toHaveText(/108,90/); // A + C
  });

  test("criterio 6: fuera de Esperando aprobación no hay botones y el servidor no deja decidir", async ({ page }) => {
    // Con la confirmación de D abierta (página vieja), el taller pasa la orden a En reparación.
    await portal.reload();
    const lineaD = linea(portal, D);
    await lineaD.getByRole("button", { name: /^Rechazar/ }).click();
    await expect(lineaD.getByTestId("portal-confirmacion")).toContainText(`¿Rechazas «${D}» por 6,05`);

    await page.goto(orderUrl);
    await page.getByRole("button", { name: "Pasar a En reparación" }).click();
    await expect(page.getByTestId("estado-actual")).toContainText("En reparación");

    // Confirmar sobre la página vieja: el servidor lo impide y la tarjeta lo explica.
    await lineaD.getByRole("button", { name: "Sí, recházalo" }).click();
    await expect(lineaD.getByRole("alert")).toContainText("El taller todavía no espera tu respuesta");
    await expect(lineaD.getByTestId("portal-confirmacion")).toBeVisible();

    // Al recargar: sin ningún botón de decisión aunque D siga pendiente.
    await portal.reload();
    await expect(portal.getByTestId("portal-estado")).toHaveText("En reparación");
    await expect(linea(portal, D).getByTestId("portal-decision")).toContainText("Pendiente");
    await expect(portal.getByRole("button", { name: /Aprobar|Rechazar/ })).toHaveCount(0);
  });
});
