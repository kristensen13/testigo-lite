import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  TOKEN_URL,
  UUID_URL,
  anadirLinea,
  canalesVivos,
  contextoCliente,
  grabarRealtime,
  joins,
  joinsAceptados,
  leaves,
  lineaPortal,
  type Frame,
} from "./helpers";

// Descripciones exclusivas de este spec: los avisos en vivo llegan a todo el taller y otros specs
// en paralelo (decision.spec) deciden trabajos con otros textos; si coincidieran, el aviso saldría duplicado.
const A = "Revisión del alternador";
const B = "Correa de servicio";
const C = "Escobillas limpiaparabrisas";

// ---------------------------------------------------------------------------
// Utilidades de prueba (nada de esto vive en el código de producción)
// ---------------------------------------------------------------------------

/**
 * Registra el texto de todos los avisos en vivo que han llegado a aparecer en el DOM (aunque se
 * cierren luego). Los avisos llegan a TODO el taller: con specs en paralelo (decision, portal,
 * flujo-completo, tests/rls...) el tablero recibe también los de otras órdenes; por eso se guardan
 * los textos y se distingue lo propio de lo ajeno por el contenido.
 */
async function registrarAvisos(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __avisosTextos: string[] };
    w.__avisosTextos = [];
    const sel = '[data-testid="aviso-en-vivo"]';
    new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of m.addedNodes)
          if (n instanceof Element)
            for (const a of n.matches(sel) ? [n] : Array.from(n.querySelectorAll(sel)))
              w.__avisosTextos.push((a.textContent ?? "").trim());
    }).observe(document, { childList: true, subtree: true });
  });
}
const textosAvisos = (page: Page) =>
  page.evaluate(() => (window as unknown as { __avisosTextos?: string[] }).__avisosTextos ?? []);

const avisos = (page: Page) => page.getByTestId("avisos-en-vivo");
// Las comprobaciones positivas localizan el aviso por el texto con la descripción propia (exclusiva
// de este spec), así que los avisos ajenos no las confunden. Límite documentado: el apilado muestra
// como máximo 3 avisos, y solo si llegaran 3 ajenos DESPUÉS del propio dentro de la ventana de
// comprobación (milisegundos) lo desplazarían; con los pocos specs que deciden líneas es inverosímil.
const aviso = (page: Page, texto: string) => avisos(page).getByTestId("aviso-en-vivo").filter({ hasText: texto });

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
    await registrarAvisos(page2);
    framesTaller2 = grabarRealtime(page2);
    await page2.goto("/");
    await expect(page2.getByRole("heading", { name: "Tablero" })).toBeVisible();
  });

  test.afterAll(async () => {
    await ctxCliente.close();
    await ctxTaller2.close();
  });

  test("preparación: orden con tres trabajos, en Esperando aprobación y con enlace", async ({ page }) => {
    // Con el servidor dev en frío las acciones tardan; no hay nada que medir aquí.
    test.setTimeout(120_000);
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Nombre").fill("Elena En Vivo");
    await page.getByLabel("Teléfono").fill("600555777");
    await page.getByLabel("Matrícula").fill(matricula);
    await page.getByLabel("Marca y modelo").fill("Seat Ibiza");
    await page.getByLabel("Kilómetros").fill("64000");
    await page.getByLabel("Avería que cuenta el cliente").fill("Aviso en vivo");
    await page.getByRole("button", { name: "Crear orden" }).click();
    await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
    orderUrl = page.url();

    await anadirLinea(page, "Mano de obra", A, "2", "40,00");
    await expect(page.getByTestId("linea")).toHaveCount(1, { timeout: 45_000 });
    await anadirLinea(page, "Recambio", B, "1", "25,50");
    await expect(page.getByTestId("linea")).toHaveCount(2, { timeout: 45_000 });
    await anadirLinea(page, "Recambio", C, "1", "10,00");
    await expect(page.getByTestId("linea")).toHaveCount(3, { timeout: 45_000 });

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
    test.setTimeout(120_000); // esperas amplias (30 s) del refresco funcional
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
    // `guardada` no se espera aquí: el aviso se cierra solo a los 8 s y, en dev, la acción del
    // portal puede confirmar mucho después de que Realtime ya lo haya entregado.
    const tGuardadaA = marca(guardada);
    tGuardadaA.catch(() => undefined); // si el test falla antes, que no quede un rechazo sin atender
    // Refresco del chip: se comprueba su corrección funcional (espera amplia de 30 s), sin umbral de 5 s.
    const tChipA = marca(expect(tarjeta).toContainText("Cliente: 1/3 decididos", { timeout: 30_000 }));
    tChipA.catch(() => undefined);
    // Las comprobaciones del aviso van en cuanto aparece (se cierra solo a los 8 s); el chip
    // se espera después, así un refresco lento no hace caducar el aviso antes de mirarlo.
    const tAviso = await marca(expect(avisoA).toBeVisible({ timeout: 15_000 }));
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

    // Dos comprobaciones distintas (decisión del usuario):
    //  (i) LATENCIA DE REALTIME, con umbral estricto de 5 s: el aviso debe aparecer en menos de 5 s
    //      desde que el portal confirma la decisión (ver `decidir`).
    //  (ii) CORRECCIÓN FUNCIONAL DEL REFRESCO: el chip se actualiza sin recargar (espera de hasta 30 s).
    //      Su tiempo se registra pero NO tiene umbral: el refresco del tablero (proxy -> layout ->
    //      consultas) depende de la latencia de red hacia Supabase (conexiones TLS nuevas si el pool
    //      lleva inactivo >4 s) y de la compilación de `next dev`; en frío ha llegado a tardar >10 s.
    const tChip = await tChipA;
    const tGuardada = await tGuardadaA;
    const medida = `TIEMPOS criterio 1: aviso ${tAviso - tGuardada} ms, chip ${tChip - tGuardada} ms (desde que el portal confirma)`;
    console.log(medida);
    expect(tAviso - tGuardada, medida).toBeLessThan(5000);
    expect(await page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga)).toBe(true);
  });

  test("criterios 2 y 3: la ficha abierta muestra la decisión, su fecha y el historial; cierre con Espacio", async ({
    page,
  }) => {
    test.setTimeout(120_000); // esperas amplias (30 s) del refresco funcional
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
    const tGuardadaB = marca(guardada);
    tGuardadaB.catch(() => undefined);
    const pFicha = Promise.all([
      // Corrección funcional del refresco de la ficha (sin recarga): espera de 30 s, tiempo solo registrado.
      marca(expect(lineaB.getByTestId("decision")).toHaveText("Rechazada", { timeout: 30_000 })),
      marca(expect(lineaB).toContainText(/Decidida por el cliente el .*\d{2}:\d{2}/, { timeout: 30_000 })),
      marca(expect(evB).toHaveCount(1, { timeout: 30_000 })),
    ]);
    pFicha.catch(() => undefined);
    // El aviso dura 8 s: se cierra con el teclado en cuanto aparece, antes de esperar al refresco de la ficha.
    const t4 = await marca(expect(avisoB).toBeVisible({ timeout: 15_000 }));
    await cerrarConTeclado(avisoB.getByRole("button", { name: "Cerrar aviso" }), page, "Space");
    await expect(avisoB).toHaveCount(0);
    const [t1, t2, t3] = await pFicha;

    const tGuardada = await tGuardadaB;
    const medida = `TIEMPOS criterio 2: decision ${t1 - tGuardada} ms, fecha ${t2 - tGuardada} ms, historial ${t3 - tGuardada} ms, aviso ${t4 - tGuardada} ms`;
    console.log(medida);
    // Umbral estricto de 5 s solo para la latencia de Realtime (el aviso); la ficha solo se registra.
    expect(t4 - tGuardada, medida).toBeLessThan(5000);
    expect(await page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga)).toBe(true);
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
    // El taller 2 no tiene actividad de ningún otro spec (solo este abre su sesión y nada decide líneas
    // allí), así que aquí no puede llegar ningún aviso, ni propio ni ajeno.
    expect(await textosAvisos(page2)).toEqual([]);
    await expect(avisos(page2).getByTestId("aviso-en-vivo")).toHaveCount(0);
    await expect(page2.getByText(matricula)).toHaveCount(0);
    expect(framesTaller2.some((f) => f.dir === "in" && f.raw.includes(C))).toBe(false);
    expect(framesTaller2.some((f) => f.dir === "in" && f.raw.includes(B))).toBe(false);
    expect(recibidosAnon.flatMap((r) => r.datos)).toEqual([]);
    await anon.removeChannel(canalAnon);
  });

  test("enlace_creado y enlace_revocado no muestran ningún aviso", async ({ page, context }) => {
    await registrarAvisos(page);
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
    // Este tablero es del taller 1 y recibe también los avisos de decisiones de OTRAS órdenes que otros
    // specs (o tests/rls) deciden en paralelo: se muestran en el log como evidencia y no cuentan. Lo
    // que no puede aparecer es ningún aviso de ESTA orden: sus trabajos A, B y C tienen descripciones
    // exclusivas de este spec y ya estaban decididos, así que cualquier aviso con ellas (o cualquier
    // aviso con el texto de un enlace) vendría de interpretar enlace_* como decisión.
    const vistos = await textosAvisos(page);
    console.log(`Avisos ajenos vistos en el tablero durante el test de enlaces: ${JSON.stringify(vistos)}`);
    const propios = vistos.filter((t) => [A, B, C].some((d) => t.includes(d)) || /enlace/i.test(t));
    expect(propios, "ningún aviso de esta orden ni de enlaces").toEqual([]);
    await expect(avisos(page).getByTestId("aviso-en-vivo").filter({ hasText: new RegExp(`${A}|${B}|${C}|enlace`, "i") })).toHaveCount(0);
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
      await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
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

  test("criterio 6: NEXT_PUBLIC_* solo URL y clave anónima, y sin la clave de servicio de Supabase en el código", () => {
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
