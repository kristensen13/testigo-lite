import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

const UUID_URL = /\/ordenes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const TOKEN_URL = /\/p\/([0-9a-f]{64})$/;

// Datos distintivos del cliente: no deben aparecer nunca en el HTML del portal.
const CLIENTE_NOMBRE = "Zacarías Quintanilla Portalez";
const CLIENTE_TELEFONO = "611987654";
const KM = "73421";

/** Contexto de navegador SIN sesión del taller y con viewport de móvil (360 px). */
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

/** Texto visible + título + código HTTP: lo que el cliente percibe de una página. */
async function huella(page: Page, ruta: string) {
  const res = await page.goto(ruta);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return {
    status: res?.status(),
    titulo: await page.title(),
    texto: await page.locator("body").innerText(),
  };
}

async function workshopPhone(request: APIRequestContext, token: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const res = await request.post(`${base}/rest/v1/rpc/portal_get`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    data: { p_token: token },
  });
  expect(res.status()).toBe(200);
  const data = (await res.json()) as { workshop: { phone: string } } | null;
  expect(data).not.toBeNull();
  return data!.workshop.phone;
}

test.describe.serial("portal del cliente (criterios 1 a 5)", () => {
  const matricula = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let orderId = "";
  let orderUrl = "";
  let token = "";

  test("preparación: orden con dos trabajos y enlace creado desde la UI", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill(CLIENTE_NOMBRE);
    await page.getByLabel("Teléfono").fill(CLIENTE_TELEFONO);
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Seat Ibiza");
    await page.getByLabel("Kilómetros").fill(KM);
    await page.getByLabel("Avería que cuenta el cliente").fill("Ruido al frenar");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
    orderUrl = page.url();
    orderId = UUID_URL.exec(orderUrl)![1];

    await anadirLinea(page, "Mano de obra", "Cambio de pastillas", "2", "40,00");
    await expect(page.getByTestId("linea")).toHaveCount(1);
    await anadirLinea(page, "Recambio", "Filtro de aire", "1", "25,50");
    await expect(page.getByTestId("linea")).toHaveCount(2);

    const seccion = page.getByRole("region", { name: "Enlace para el cliente" });
    await seccion.getByRole("button", { name: "Enlace para el cliente" }).click();
    await expect(page.getByTestId("url-cliente")).toBeVisible();
    const m = TOKEN_URL.exec((await page.getByTestId("url-cliente").innerText()).trim());
    expect(m, "la URL debe acabar en /p/<64 hex>").not.toBeNull();
    token = m![1];
  });

  test("criterio 1: estado del cliente, vehículo, trabajos y totales", async ({ browser, baseURL }) => {
    const ctx = await contextoCliente(browser, baseURL);
    const page = await ctx.newPage();
    await page.goto(`/p/${token}`);

    await expect(page.getByTestId("portal-estado")).toHaveText("Recibido");
    await expect(page.getByTestId("portal-matricula")).toHaveText(matricula);
    await expect(page.getByTestId("portal-vehiculo")).toHaveText("Seat Ibiza");

    const lineas = page.getByTestId("portal-linea");
    await expect(lineas).toHaveCount(2);
    await expect(lineas.nth(0)).toContainText("Cambio de pastillas");
    await expect(lineas.nth(0)).toContainText("Mano de obra");
    await expect(lineas.nth(0)).toContainText(/2 × 40,00/);
    await expect(lineas.nth(0)).toContainText(/80,00/);
    await expect(lineas.nth(0).getByTestId("portal-decision")).toContainText("Pendiente");
    await expect(lineas.nth(1)).toContainText("Filtro de aire");
    await expect(lineas.nth(1)).toContainText("Recambio");
    await expect(lineas.nth(1)).toContainText(/1 × 25,50/);

    await expect(page.getByTestId("portal-total-base")).toHaveText(/105,50/);
    await expect(page.getByTestId("portal-total-iva")).toHaveText(/22,16/);
    await expect(page.getByTestId("portal-total")).toHaveText(/127,66/);
    await expect(page.getByTestId("portal-total-aprobado")).toHaveText(/0,00/);

    // Tira de progreso: forma y texto, no solo color.
    const pasos = page.getByTestId("portal-progreso").getByRole("listitem");
    await expect(pasos).toHaveCount(6);
    await expect(pasos.nth(0)).toContainText("Ahora");
    await expect(pasos.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(pasos.nth(1)).toContainText("Pendiente");

    await expect(page.getByRole("link", { name: /Llamar al taller/ })).toHaveAttribute("href", /^tel:\+?\d+$/);
    await expect(page.getByTestId("portal-caducidad")).toContainText(/válido hasta/);
    await expect(page.getByText("Testigo", { exact: true })).toBeVisible();
    await ctx.close();
  });

  test("criterio 2: el HTML no contiene datos del cliente pero sí el teléfono del taller", async ({
    browser,
    baseURL,
    request,
  }) => {
    const tallerTel = await workshopPhone(request, token);
    const ctx = await contextoCliente(browser, baseURL);
    const page = await ctx.newPage();
    const res = await page.goto(`/p/${token}`);
    await expect(page.getByTestId("portal-estado")).toBeVisible();

    const cabeceras = res!.headers();
    expect(cabeceras["referrer-policy"]).toBe("no-referrer");
    expect(cabeceras["x-robots-tag"]).toMatch(/noindex/);
    expect(cabeceras["cache-control"]).toMatch(/no-store/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    for (const html of [await res!.text(), await page.content()]) {
      expect(html).toContain(tallerTel);
      expect(html).not.toContain(CLIENTE_TELEFONO);
      expect(html).not.toContain(CLIENTE_NOMBRE);
      expect(html).not.toContain("Zacarías");
      expect(html).not.toContain("Quintanilla");
      expect(html).not.toContain(KM);
      expect(html).not.toContain("73.421");
      expect(html).not.toContain(orderId);
    }
    await ctx.close();
  });

  test("criterio 4: sin scroll horizontal, texto ≥ 16 px y contraste AA a 360 px", async ({ browser, baseURL }) => {
    const ctx = await contextoCliente(browser, baseURL);
    const page = await ctx.newPage();
    await page.goto(`/p/${token}`);
    await expect(page.getByTestId("portal-estado")).toBeVisible();

    const medidas = await page.evaluate(() => {
      const de = document.documentElement;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const g = canvas.getContext("2d", { willReadFrequently: true })!;
      const rgba = (css: string): [number, number, number, number] => {
        g.clearRect(0, 0, 1, 1);
        g.fillStyle = "#000";
        g.fillStyle = css;
        g.fillRect(0, 0, 1, 1);
        const d = g.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const lum = ([r, gg, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
      };
      const fondo = (el: Element): number[] => {
        for (let e: Element | null = el; e; e = e.parentElement) {
          const c = rgba(getComputedStyle(e).backgroundColor);
          if (c[3] > 0.99) return c;
        }
        return [255, 255, 255, 1];
      };
      const textos: { texto: string; ratio: number; px: number }[] = [];
      for (const el of Array.from(document.querySelectorAll("main *"))) {
        const propio = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
        if (!propio) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || (el as HTMLElement).offsetWidth <= 1) continue; // p. ej. sr-only
        const fg = rgba(cs.color);
        const bg = fondo(el);
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        textos.push({ texto: (el.textContent ?? "").trim().slice(0, 30), ratio, px: parseFloat(cs.fontSize) });
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, textos };
    });

    expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth);
    expect(medidas.textos.length).toBeGreaterThan(15);
    for (const t of medidas.textos) {
      expect(t.px, `tamaño de «${t.texto}»`).toBeGreaterThanOrEqual(16);
      expect(t.ratio, `contraste de «${t.texto}»`).toBeGreaterThanOrEqual(4.5);
    }

    // El texto de lectura (descripción del trabajo) usa 16 px o más y el enlace es táctil (≥ 48 px).
    const px = await page.getByTestId("portal-linea").first().locator("p").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px).toBeGreaterThanOrEqual(16);
    const alto = (await page.getByRole("link", { name: /Llamar al taller/ }).boundingBox())!.height;
    expect(alto).toBeGreaterThanOrEqual(48);
    // El zoom no está bloqueado.
    const vp = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(vp ?? "").not.toMatch(/user-scalable=no|maximum-scale=1(\.0)?(,|$)/);
    await ctx.close();
  });

  test("criterio 5: cada estado muestra su etiqueta y no hay botones de decisión", async ({ page, browser, baseURL }) => {
    const ctx = await contextoCliente(browser, baseURL);
    const portal = await ctx.newPage();
    const botonesDecision = portal.getByRole("button", { name: /Aprobar|Rechazar/ });

    await portal.goto(`/p/${token}`);
    await expect(portal.getByTestId("portal-estado")).toHaveText("Recibido");
    await expect(botonesDecision).toHaveCount(0);

    await page.goto(orderUrl);
    await page.getByRole("button", { name: "Pasar a Diagnóstico" }).click();
    await expect(page.getByRole("button", { name: "Pasar a Esperando aprobación" })).toBeVisible();
    await portal.reload();
    await expect(portal.getByTestId("portal-estado")).toHaveText("En diagnóstico");
    await expect(botonesDecision).toHaveCount(0);

    await page.getByRole("button", { name: "Pasar a Esperando aprobación" }).click();
    await expect(page.getByRole("button", { name: "Pasar a En reparación" })).toBeVisible();
    await portal.reload();
    // Aquí T13 añadirá los botones: solo se comprueba la etiqueta.
    await expect(portal.getByTestId("portal-estado")).toHaveText("Necesitamos tu OK");
    await ctx.close();
  });

  test("criterio 3: inventado, malformado, revocado y caducado dan la misma página", async ({
    page,
    browser,
    baseURL,
    request,
  }) => {
    // Revocado desde la UI del taller.
    await page.goto(orderUrl);
    await page.getByRole("region", { name: "Enlace para el cliente" }).getByRole("button", { name: "Revocar enlace" }).click();
    await expect(page.getByTestId("estado-enlace")).toHaveText(/Enlace revocado/);

    // Caducado: la UI usa 7 días, así que se crea con TTL 0 por la RPC (un inicio de sesión extra).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const login = await request.post(`${url}/auth/v1/token?grant_type=password`, {
      headers: { apikey: key, "Content-Type": "application/json" },
      data: { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD },
    });
    expect(login.status(), "inicio de sesión por API").toBe(200);
    const accessToken = ((await login.json()) as { access_token: string }).access_token;
    const creado = await request.post(`${url}/rest/v1/rpc/create_public_link`, {
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      data: { p_order_id: orderId, p_ttl_days: 0 },
    });
    expect(creado.status(), "create_public_link con TTL 0").toBe(200);
    const tokenCaducado = (await creado.json()) as string;
    expect(tokenCaducado).toMatch(/^[0-9a-f]{64}$/);

    const ctx = await contextoCliente(browser, baseURL);
    const portal = await ctx.newPage();
    const inventado = await huella(portal, `/p/${"ab".repeat(32)}`);
    const revocado = await huella(portal, `/p/${token}`);
    const caducado = await huella(portal, `/p/${tokenCaducado}`);
    const malformado = await huella(portal, "/p/esto-no-es-un-token");
    const mayusculas = await huella(portal, `/p/${"AB".repeat(32)}`);

    expect(inventado.texto).toMatch(/Este enlace ya no está disponible/i);
    expect(inventado.texto).toMatch(/Pide al taller que te envíe uno nuevo/i);
    for (const otro of [revocado, caducado, malformado, mayusculas]) {
      expect(otro.status).toBe(inventado.status);
      expect(otro.titulo).toBe(inventado.titulo);
      expect(otro.texto).toBe(inventado.texto);
    }
    // Nada del vehículo ni del taller se filtra en la página no disponible.
    expect(revocado.texto).not.toContain(matricula);
    await ctx.close();
  });
});

// El proxy no consulta la sesión en /p/*: aunque el navegador traiga la sesión del taller
// (este proyecto la usa por defecto), el portal responde igual que a un cliente anónimo.
test("el proxy no toca /p/*: mismas cabeceras, sin cookies y misma página con sesión del taller", async ({
  page,
  browser,
  baseURL,
}) => {
  const ruta = `/p/${"cd".repeat(32)}`;
  const conSesion = await page.request.get(ruta);
  const ctx = await contextoCliente(browser, baseURL);
  const sinSesion = await ctx.request.get(ruta);

  for (const res of [conSesion, sinSesion]) {
    const h = res.headers();
    expect(res.status()).toBe(200);
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    expect(h["cache-control"]).toContain("no-store");
    expect(h["set-cookie"]).toBeUndefined();
  }
  expect(await conSesion.text()).toContain("Este enlace ya no está disponible");
  // Para el taller, en cambio, el resto de rutas sigue exigiendo sesión.
  const privada = await ctx.request.get("/", { maxRedirects: 0 });
  expect(privada.status()).toBe(307);
  expect(privada.headers()["location"]).toContain("/login");
  await ctx.close();
});
