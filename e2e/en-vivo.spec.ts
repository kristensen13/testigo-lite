import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const UUID_URL = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_URL = /\/p\/([0-9a-f]{64})$/;

const A = "Cambio de pastillas";
const B = "Filtro de aire";
const C = "Líquido de frenos";

// ---------------------------------------------------------------------------
// Utilidades de prueba (nada de esto vive en el código de producción)
// ---------------------------------------------------------------------------

type Frame = { dir: "out" | "in"; topic: string; event: string; payload: unknown; raw: string };

/**
 * Registra los frames del WebSocket de Realtime de una página (page.on('websocket')).
 * Es el método de observación del canal: cada canal es un topic `realtime:<nombre>`;
 * `phx_join` = alta y `phx_leave` = baja (removeChannel). Soporta el serializador
 * de Realtime v2 (frames en forma de array) y el v1 (objeto).
 */
function grabarRealtime(page: Page): Frame[] {
  const frames: Frame[] = [];
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/realtime/")) return;
    const anota = (dir: "out" | "in") => (f: { payload: string | Buffer }) => {
      if (typeof f.payload !== "string") return;
      try {
        const j: unknown = JSON.parse(f.payload);
        if (Array.isArray(j)) frames.push({ dir, topic: String(j[2]), event: String(j[3]), payload: j[4], raw: f.payload });
        else if (typeof j === "object" && j !== null) {
          const o = j as { topic?: unknown; event?: unknown; payload?: unknown };
          frames.push({ dir, topic: String(o.topic), event: String(o.event), payload: o.payload, raw: f.payload });
        }
      } catch {
        // Frame que no es JSON: se ignora.
      }
    };
    ws.on("framesent", anota("out"));
    ws.on("framereceived", anota("in"));
  });
  return frames;
}

const esCanalPropio = (f: Frame) => f.topic.startsWith("realtime:taller-en-vivo-");
const joins = (frames: Frame[]) => frames.filter((f) => f.dir === "out" && f.event === "phx_join" && esCanalPropio(f));
const leaves = (frames: Frame[]) => frames.filter((f) => f.dir === "out" && f.event === "phx_leave" && esCanalPropio(f));
const joinsAceptados = (frames: Frame[]) =>
  frames.filter(
    (f) =>
      f.dir === "in" &&
      f.event === "phx_reply" &&
      esCanalPropio(f) &&
      (f.payload as { status?: string } | null)?.status === "ok",
  );
/** Canales propios con más altas que bajas: los que siguen vivos. */
function canalesVivos(frames: Frame[]): string[] {
  const saldo = new Map<string, number>();
  for (const f of joins(frames)) saldo.set(f.topic, (saldo.get(f.topic) ?? 0) + 1);
  for (const f of leaves(frames)) saldo.set(f.topic, (saldo.get(f.topic) ?? 0) - 1);
  return [...saldo].filter(([, n]) => n > 0).map(([t]) => t);
}

/** Cuenta cuántos avisos en vivo han llegado a aparecer en el DOM (aunque se cierren luego). */
async function contarAvisosVistos(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __avisosVistos: number };
    w.__avisosVistos = 0;
    new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of m.addedNodes)
          if (
            n instanceof Element &&
            (n.matches('[data-testid="aviso-en-vivo"]') || n.querySelector('[data-testid="aviso-en-vivo"]'))
          )
            w.__avisosVistos++;
    }).observe(document, { childList: true, subtree: true });
  });
}
const avisosVistos = (page: Page) =>
  page.evaluate(() => (window as unknown as { __avisosVistos?: number }).__avisosVistos ?? 0);

const avisos = (page: Page) => page.getByTestId("avisos-en-vivo");
const aviso = (page: Page, texto: string) => avisos(page).getByTestId("aviso-en-vivo").filter({ hasText: texto });

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

const lineaPortal = (page: Page, descripcion: string) =>
  page.getByTestId("portal-linea").filter({ hasText: descripcion });

/** Resuelve con el instante (ms) en que se cumple la promesa. */
const marca = (p: Promise<unknown>) => p.then(() => Date.now());

/**
 * El cliente decide en el portal. Devuelve `guardada`: promesa que se cumple cuando el portal
 * muestra la decisión (la BD ya la tiene). Los 5 s de Realtime se miden desde ese instante, porque
 * la acción del servidor en dev (compilación en frío) no es parte de lo que se prueba; quien la
 * llama debe esperarla antes de seguir (así no se navega con la acción en vuelo).
 */
async function decidir(portal: Page, token: string, descripcion: string, decision: "aprobar" | "rechazar") {
  await portal.goto(`/p/${token}`);
  const l = lineaPortal(portal, descripcion);
  await l.getByRole("button", { name: decision === "aprobar" ? /^Aprobar/ : /^Rechazar/ }).click();
  const confirmar = l.getByRole("button", { name: decision === "aprobar" ? "Sí, apruébalo" : "Sí, recházalo" });
  await confirmar.click();
  const guardada = expect(l.getByTestId("portal-decision")).toContainText(
    decision === "aprobar" ? /Aprobado el/ : /Rechazado el/,
    { timeout: 30_000 },
  );
  return { guardada };
}

async function cerrarConTeclado(boton: Locator, page: Page, tecla: "Enter" | "Space") {
  await boton.focus();
  await expect(boton).toBeFocused();
  await page.keyboard.press(tecla);
}

// ---------------------------------------------------------------------------

test.describe.serial("avisos en vivo (T14)", () => {
  const matricula = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let orderUrl = "";
  let token = "";
  let portal: Page;
  let ctxCliente: BrowserContext;
  let ctxTaller2: BrowserContext;
  let page2: Page;
  let framesTaller2: Frame[] = [];

  test.beforeAll(async ({ browser, baseURL }) => {
    ctxCliente = await contextoCliente(browser, baseURL);
    portal = await ctxCliente.newPage();

    // Cuarto contexto: usuario del taller 2 (un único inicio de sesión extra), con el tablero abierto.
    const email = process.env.E2E_EMAIL_2;
    const password = process.env.E2E_PASSWORD_2;
    expect(email, "Falta E2E_EMAIL_2").toBeTruthy();
    expect(password, "Falta E2E_PASSWORD_2").toBeTruthy();
    ctxTaller2 = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    page2 = await ctxTaller2.newPage();
    await page2.goto("/login");
    await page2.getByLabel("Email").fill(email!);
    await page2.getByLabel("Contraseña").fill(password!);
    await page2.getByRole("button", { name: "Entrar" }).click();
    await expect(page2.getByTestId("workshop-name")).toBeVisible({ timeout: 30_000 });
    await contarAvisosVistos(page2);
    framesTaller2 = grabarRealtime(page2);
    await page2.goto("/");
    await expect(page2.getByRole("heading", { name: "Tablero" })).toBeVisible();
  });

  test.afterAll(async () => {
    await ctxCliente.close();
    await ctxTaller2.close();
  });

  test("preparación: orden con tres trabajos, en Esperando aprobación y con enlace", async ({ page }) => {
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill("Elena En Vivo");
    await page.getByLabel("Teléfono").fill("600555777");
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Seat Ibiza");
    await page.getByLabel("Kilómetros").fill("64000");
    await page.getByLabel("Avería que cuenta el cliente").fill("Aviso en vivo");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL);
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

  test("criterios 1 y 3: el tablero abierto se actualiza solo y avisa; el aviso es aria-live y se cierra con Enter", async ({
    page,
  }) => {
    await page.goto(`/?q=${matricula}`);
    const tarjeta = page.getByRole("link", { name: new RegExp(matricula) });
    await expect(tarjeta).toHaveCount(1);
    await expect(tarjeta).not.toContainText("decididos");
    // Señal positiva: el canal propio está conectado antes de provocar el cambio.
    const frames = grabarRealtime(page);
    await page.reload();
    await expect(tarjeta).toHaveCount(1);
    await expect.poll(() => joinsAceptados(frames).length).toBeGreaterThan(0);
    // Marca para comprobar que no hay recarga.
    await page.evaluate(() => ((window as unknown as { __sinRecarga: boolean }).__sinRecarga = true));

    const { guardada } = await decidir(portal, token, A, "aprobar");
    const avisoA = aviso(page, `El cliente ha aprobado «${A}»`);
    const [tChip, tAviso, tGuardada] = await Promise.all([
      marca(expect(tarjeta).toContainText("Cliente: 1/3 decididos", { timeout: 15_000 })),
      marca(expect(avisoA).toBeVisible({ timeout: 15_000 })),
      marca(guardada),
    ]);
    expect(Math.max(tChip, tAviso) - tGuardada, `chip +${tChip - tGuardada} ms, aviso +${tAviso - tGuardada} ms`).toBeLessThan(5000);
    expect(await page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga)).toBe(true);

    // Criterio 3: región aria-live educada, texto en castellano, sin datos sensibles y cierre con teclado.
    const region = avisos(page);
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toHaveAttribute("role", "status");
    expect(await region.getByTestId("aviso-en-vivo").first().evaluate((el) => el.closest("[aria-live]") !== null)).toBe(true);
    await expect(avisoA).not.toContainText("600555777");
    await expect(avisoA).not.toContainText(matricula);
    const cerrar = avisoA.getByRole("button", { name: "Cerrar aviso" });
    expect((await cerrar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await cerrar.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await cerrarConTeclado(cerrar, page, "Enter");
    await expect(avisoA).toHaveCount(0);
  });

  test("criterios 2 y 3: la ficha abierta muestra la decisión, su fecha y el historial; cierre con Espacio", async ({
    page,
  }) => {
    await page.goto(orderUrl);
    const lineaB = page.getByTestId("linea").filter({ hasText: B });
    await expect(lineaB.getByTestId("decision")).toHaveText("Pendiente");
    const historial = page.getByRole("region", { name: "Historial" });
    const evB = historial.getByRole("listitem").filter({ hasText: `El cliente rechazó «${B}»` });
    await expect(evB).toHaveCount(0);
    const frames = grabarRealtime(page);
    await page.reload();
    await expect(lineaB.getByTestId("decision")).toHaveText("Pendiente");
    await expect.poll(() => joinsAceptados(frames).length).toBeGreaterThan(0);
    await page.evaluate(() => ((window as unknown as { __sinRecarga: boolean }).__sinRecarga = true));

    const { guardada } = await decidir(portal, token, B, "rechazar");
    const avisoB = aviso(page, `El cliente ha rechazado «${B}»`);
    const [t1, t2, t3, t4, tGuardada] = await Promise.all([
      marca(expect(lineaB.getByTestId("decision")).toHaveText("Rechazada", { timeout: 15_000 })),
      marca(expect(lineaB).toContainText(/Decidida por el cliente el .*\d{2}:\d{2}/, { timeout: 15_000 })),
      marca(expect(evB).toHaveCount(1, { timeout: 15_000 })),
      marca(expect(avisoB).toBeVisible({ timeout: 15_000 })),
      marca(guardada),
    ]);
    expect(Math.max(t1, t2, t3, t4) - tGuardada).toBeLessThan(5000);
    expect(await page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga)).toBe(true);
    await guardada;
    await cerrarConTeclado(avisoB.getByRole("button", { name: "Cerrar aviso" }), page, "Space");
    await expect(avisoB).toHaveCount(0);
  });

  test("criterio 4: un usuario del taller 2 con el tablero abierto no recibe avisos ni cambios del taller 1", async ({
    page,
  }) => {
    // Señal positiva: el canal Realtime del usuario 2 está suscrito (la ausencia no es trivial).
    await expect.poll(() => joinsAceptados(framesTaller2).length).toBeGreaterThan(0);
    expect(canalesVivos(framesTaller2)).toHaveLength(1);

    // Sin sesión (clave anónima): se puede suscribir, pero RLS no le deja recibir nada.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Realtime puede avisar a un anónimo de que "hubo un cambio" pero con error 401 y sin ningún dato.
    const recibidosAnon: { table: string; datos: string[] }[] = [];
    let estadoAnon = "";
    const anota = (p: { table: string; new: Record<string, unknown>; old: Record<string, unknown> }) =>
      recibidosAnon.push({ table: p.table, datos: [...Object.keys(p.new), ...Object.keys(p.old)] });
    const canalAnon = anon
      .channel("e2e-anon-sin-sesion")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_lines" }, anota)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_events" }, anota)
      .subscribe((s) => (estadoAnon = s));
    await expect.poll(() => estadoAnon).toBe("SUBSCRIBED");

    // Control positivo: el taller 1 sí recibe la decisión del cliente.
    await page.goto(`/?q=${matricula}`);
    const tarjeta = page.getByRole("link", { name: new RegExp(matricula) });
    await expect(tarjeta).toContainText("Cliente: 2/3 decididos");
    const frames = grabarRealtime(page);
    await page.reload();
    await expect.poll(() => joinsAceptados(frames).length).toBeGreaterThan(0);
    const { guardada } = await decidir(portal, token, C, "aprobar");
    await Promise.all([
      expect(aviso(page, `El cliente ha aprobado «${C}»`)).toBeVisible({ timeout: 15_000 }),
      expect(tarjeta).toContainText("Cliente: 3/3 decididos", { timeout: 15_000 }),
      guardada,
    ]);

    // Margen razonable antes de afirmar la ausencia.
    await page2.waitForTimeout(7000);
    expect(await avisosVistos(page2)).toBe(0);
    await expect(avisos(page2).getByTestId("aviso-en-vivo")).toHaveCount(0);
    await expect(page2.getByText(matricula)).toHaveCount(0);
    expect(framesTaller2.some((f) => f.dir === "in" && f.raw.includes(C))).toBe(false);
    expect(framesTaller2.some((f) => f.dir === "in" && f.raw.includes(B))).toBe(false);
    expect(recibidosAnon.flatMap((r) => r.datos)).toEqual([]);
    await anon.removeChannel(canalAnon);
  });

  test("enlace_creado y enlace_revocado no muestran ningún aviso", async ({ page, context }) => {
    await contarAvisosVistos(page);
    const frames = grabarRealtime(page);
    await page.goto(`/?q=${matricula}`);
    await expect(page.getByRole("link", { name: new RegExp(matricula) })).toHaveCount(1);
    await expect.poll(() => joinsAceptados(frames).length).toBeGreaterThan(0);

    // Otro contexto de pestaña (mismo usuario): genera un enlace nuevo y lo revoca con la UI de T11.
    const otra = await context.newPage();
    await otra.goto(orderUrl);
    const seccion = otra.getByRole("region", { name: "Enlace para el cliente" });
    await seccion.getByRole("button", { name: "Generar enlace nuevo" }).click();
    await expect(otra.getByTestId("url-cliente")).toBeVisible();
    await seccion.getByRole("button", { name: "Revocar enlace" }).click();
    await expect(otra.getByTestId("estado-enlace")).toHaveText(/Enlace revocado/);
    await expect(otra.getByRole("region", { name: "Historial" }).getByRole("listitem").filter({ hasText: /Enlace para el cliente (creado|revocado)/ }).first()).toBeVisible();
    await otra.close();

    // Señal positiva: los eventos enlace_* SÍ llegan al navegador por Realtime (no hay filtro de
    // servidor posible) y aun así no generan aviso: el filtro por type='decision' es del cliente.
    await expect
      .poll(() => frames.some((f) => f.dir === "in" && /enlace_creado/.test(f.raw)) && frames.some((f) => f.dir === "in" && /enlace_revocado/.test(f.raw)), { timeout: 10_000 })
      .toBe(true);
    await page.waitForTimeout(6000);
    expect(await avisosVistos(page)).toBe(0);
    await expect(avisos(page).getByTestId("aviso-en-vivo")).toHaveCount(0);
  });

  test("criterio 5: no se acumulan canales al navegar entre tablero y ficha", async ({ page }) => {
    const frames = grabarRealtime(page);
    await page.goto(`/?q=${matricula}`);
    const tarjeta = page.getByRole("link", { name: new RegExp(matricula) });
    await expect(tarjeta).toHaveCount(1);
    await expect.poll(() => canalesVivos(frames).length).toBe(1);
    const altasIniciales = joins(frames).length;

    for (let i = 0; i < 4; i++) {
      await tarjeta.click();
      await expect(page).toHaveURL(UUID_URL);
      await expect(page.getByTestId("estado-actual")).toBeVisible();
      await page.getByRole("link", { name: "Volver al tablero" }).click();
      await expect(tarjeta).toHaveCount(1);
    }
    await page.waitForTimeout(1000);
    // Un único canal vivo, sin altas nuevas por navegar, y las altas previas (montaje doble de React en dev) tienen su baja.
    expect(canalesVivos(frames)).toHaveLength(1);
    expect(joins(frames)).toHaveLength(altasIniciales);
    expect(joins(frames).length - leaves(frames).length).toBe(1);
  });

  test("criterio 6: NEXT_PUBLIC_* solo URL y clave anónima, y sin service_role en el código", () => {
    const git = (args: string[]) => {
      try {
        return execFileSync("git", args, { encoding: "utf8" });
      } catch (e) {
        if ((e as { status?: number }).status === 1) return ""; // git grep: sin coincidencias
        throw e;
      }
    };
    const prohibido = ["service", "role"].join("_");
    const rutas = ["src", "e2e", "tests", "supabase", "next.config.ts", "playwright.config.ts", ".env.example"];
    // .env.example solo la menciona en un comentario ("nunca ...") y los documentos del plan, igual.
    expect(git(["grep", "-ni", "-e", prohibido, "--", ...rutas.filter((r) => r !== ".env.example")])).toBe("");

    const nombres = new Set(
      git(["grep", "-hoE", "NEXT_PUBLIC_[A-Z0-9_]+", "--", ...rutas])
        .split("\n")
        .filter(Boolean),
    );
    expect([...nombres].sort()).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  });
});
