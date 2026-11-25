// Utilidades compartidas por los E2E nuevos y por en-vivo.spec.ts (solo de prueba).
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const UUID_URL = /\/ordenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const TOKEN_URL = /\/p\/([0-9a-f]{64})$/;

/** Matrícula única de prueba: siempre empieza por E2E (el seed limpia estas órdenes). */
export const matriculaE2E = () => `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/** Contexto de navegador SIN sesión del taller y con viewport de móvil (360 px). */
export async function contextoCliente(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    viewport: { width: 360, height: 740 },
    storageState: { cookies: [], origins: [] },
  });
}

export async function anadirLinea(page: Page, tipo: string, descripcion: string, cantidad: string, precio: string) {
  const form = page.getByRole("form", { name: "Añadir línea" });
  await form.getByLabel("Tipo").selectOption({ label: tipo });
  await form.getByLabel("Descripción").fill(descripcion);
  await form.getByLabel("Cantidad").fill(cantidad);
  await form.getByLabel(/^Precio unitario/).fill(precio);
  await form.getByRole("button", { name: "Añadir línea" }).click();
}

export const lineaPortal = (page: Page, descripcion: string) =>
  page.getByTestId("portal-linea").filter({ hasText: descripcion });

export type Trabajo = { tipo: "Mano de obra" | "Recambio"; descripcion: string; cantidad: string; precio: string };

/** Crea una orden por la UI (queda en su ficha) y añade los trabajos del presupuesto. */
export async function crearOrdenConTrabajos(
  page: Page,
  datos: { nombre: string; telefono: string; matricula: string; modelo: string; km: string; averia: string },
  trabajos: Trabajo[],
): Promise<string> {
  await page.goto("/ordenes/nueva");
  await page.getByLabel("Nombre").fill(datos.nombre);
  await page.getByLabel("Teléfono").fill(datos.telefono);
  await page.getByLabel("Matrícula").fill(datos.matricula);
  await page.getByLabel("Marca y modelo").fill(datos.modelo);
  await page.getByLabel("Kilómetros").fill(datos.km);
  await page.getByLabel("Avería que cuenta el cliente").fill(datos.averia);
  await page.getByRole("button", { name: "Crear orden" }).click();
  await expect(page).toHaveURL(UUID_URL, { timeout: 45_000 });
  const url = page.url();
  let n = 0;
  for (const t of trabajos) {
    await anadirLinea(page, t.tipo, t.descripcion, t.cantidad, t.precio);
    await expect(page.getByTestId("linea")).toHaveCount(++n, { timeout: 45_000 });
  }
  return url;
}

/** Recibido -> Diagnóstico -> Esperando aprobación, desde la ficha. */
export async function pasarAEsperandoAprobacion(page: Page) {
  await page.getByRole("button", { name: "Pasar a Diagnóstico" }).click();
  await expect(page.getByRole("button", { name: "Pasar a Esperando aprobación" })).toBeVisible();
  await page.getByRole("button", { name: "Pasar a Esperando aprobación" }).click();
  await expect(page.getByTestId("estado-actual")).toContainText("Esperando aprobación");
}

/** Pulsa "Enlace para el cliente" en la ficha y devuelve el token (64 hex) de la URL mostrada. */
export async function generarEnlace(page: Page): Promise<string> {
  const seccion = page.getByRole("region", { name: "Enlace para el cliente" });
  await seccion.getByRole("button", { name: "Enlace para el cliente" }).click();
  await expect(page.getByTestId("url-cliente")).toBeVisible();
  const m = TOKEN_URL.exec((await page.getByTestId("url-cliente").innerText()).trim());
  expect(m, "la URL debe acabar en /p/<64 hex>").not.toBeNull();
  return m![1];
}

/** Inicio de sesión real por la UI (credenciales de process.env; nunca se imprimen). */
export async function iniciarSesionUI(page: Page, email: string | undefined, password: string | undefined) {
  expect(email, "Falta E2E_EMAIL").toBeTruthy();
  expect(password, "Falta E2E_PASSWORD").toBeTruthy();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("workshop-name")).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Observación del canal Realtime
// ---------------------------------------------------------------------------

export type Frame = { dir: "out" | "in"; topic: string; event: string; payload: unknown; raw: string };

/**
 * Registra los frames del WebSocket de Realtime de una página (page.on('websocket')).
 * Es el método de observación del canal: cada canal es un topic `realtime:<nombre>`;
 * `phx_join` = alta y `phx_leave` = baja (removeChannel). Soporta el serializador
 * de Realtime v2 (frames en forma de array) y el v1 (objeto).
 */
export function grabarRealtime(page: Page): Frame[] {
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

export const esCanalPropio = (f: Frame) => f.topic.startsWith("realtime:taller-en-vivo-");
export const joins = (frames: Frame[]) => frames.filter((f) => f.dir === "out" && f.event === "phx_join" && esCanalPropio(f));
export const leaves = (frames: Frame[]) => frames.filter((f) => f.dir === "out" && f.event === "phx_leave" && esCanalPropio(f));
export const joinsAceptados = (frames: Frame[]) =>
  frames.filter(
    (f) =>
      f.dir === "in" &&
      f.event === "phx_reply" &&
      esCanalPropio(f) &&
      (f.payload as { status?: string } | null)?.status === "ok",
  );
/** Canales propios con más altas que bajas: los que siguen vivos. */
export function canalesVivos(frames: Frame[]): string[] {
  const saldo = new Map<string, number>();
  for (const f of joins(frames)) saldo.set(f.topic, (saldo.get(f.topic) ?? 0) + 1);
  for (const f of leaves(frames)) saldo.set(f.topic, (saldo.get(f.topic) ?? 0) - 1);
  return [...saldo].filter(([, n]) => n > 0).map(([t]) => t);
}
