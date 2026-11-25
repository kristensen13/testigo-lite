import { expect, test, type Page } from "@playwright/test";
import {
  UUID_URL,
  contextoCliente,
  crearOrdenConTrabajos,
  generarEnlace,
  grabarRealtime,
  iniciarSesionUI,
  joinsAceptados,
  lineaPortal,
  matriculaE2E,
  pasarAEsperandoAprobacion,
} from "./helpers";

// Descripciones propias de este test: los avisos en vivo llegan a todo el taller, y otros
// specs en paralelo (en-vivo, decision) usan otras, así que no se pisan los textos de los avisos.
const A = "Sustitución de embrague"; // 2 h x 40,00 -> 96,80 € con IVA
const B = "Kit de distribución"; // 1 x 25,50 -> 30,86 € con IVA
const C = "Aceite de caja"; // 1 x 10,00 -> 12,10 € con IVA

const FECHA = /\d{4}.*\d{2}:\d{2}/;

const aviso = (page: Page, texto: string) =>
  page.getByTestId("avisos-en-vivo").getByTestId("aviso-en-vivo").filter({ hasText: texto });

/** Marca la página para comprobar después que no se ha recargado. */
const marcarSinRecarga = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __sinRecarga: boolean }).__sinRecarga = true));
const sigueSinRecargar = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga === true);

test("flujo completo: login real, orden, presupuesto, enlace, decisión del cliente y aviso en vivo", async ({
  browser,
  baseURL,
}) => {
  // Recorrido largo con cuatro contextos de navegador: margen para el servidor dev bajo carga.
  test.setTimeout(150_000);
  const matricula = matriculaE2E();

  // 1. Inicio de sesión REAL por la UI, en un contexto limpio (sin la sesión compartida).
  const ctxTaller = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const ctxCliente = await contextoCliente(browser, baseURL);
  try {
    const taller = await ctxTaller.newPage();
    await iniciarSesionUI(taller, process.env.E2E_EMAIL, process.env.E2E_PASSWORD);
    await expect(taller.getByRole("heading", { name: "Tablero" })).toBeVisible();

    // 2. Nueva orden con presupuesto de varios trabajos. El teléfono no es válido para WhatsApp
    //    (el formulario ya rechaza teléfonos no válidos).
    const orderUrl = await crearOrdenConTrabajos(
      taller,
      {
        nombre: "Lucía Flujo Completo",
        telefono: "600 123 456",
        matricula,
        modelo: "Ford Focus",
        km: "120000",
        averia: "Ruido al frenar",
      },
      [
        { tipo: "Mano de obra", descripcion: A, cantidad: "2", precio: "40,00" },
        { tipo: "Recambio", descripcion: B, cantidad: "1", precio: "25,50" },
        { tipo: "Recambio", descripcion: C, cantidad: "1", precio: "10,00" },
      ],
    );
    await expect(taller.getByTestId("total-presupuesto")).toHaveText(/139,76/);

    // 3. Esperando aprobación y enlace para el cliente.
    await pasarAEsperandoAprobacion(taller);
    const token = await generarEnlace(taller);
    const seccion = taller.getByRole("region", { name: "Enlace para el cliente" });
    await expect(seccion.getByRole("link", { name: "Compartir por WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/34600123456\?text=/,
    );
    await expect(seccion.getByRole("button", { name: "Copiar enlace" })).toBeVisible();

    // 4. El taller deja abiertos el tablero y la ficha, con su canal en vivo ya suscrito.
    const tablero = await ctxTaller.newPage();
    const framesTablero = grabarRealtime(tablero);
    await tablero.goto(`/?q=${matricula}`);
    const tarjeta = tablero.getByRole("link", { name: new RegExp(matricula) });
    await expect(tarjeta).toHaveCount(1);
    await expect(tarjeta).not.toContainText("decididos");

    const ficha = await ctxTaller.newPage();
    const framesFicha = grabarRealtime(ficha);
    await ficha.goto(orderUrl);
    await expect(ficha).toHaveURL(UUID_URL, { timeout: 45_000 }); // la acción de servidor puede tardar con next dev en frío
    const lineas = ficha.getByTestId("linea");
    await expect(lineas).toHaveCount(3);

    await expect.poll(() => joinsAceptados(framesTablero).length).toBeGreaterThan(0);
    await expect.poll(() => joinsAceptados(framesFicha).length).toBeGreaterThan(0);
    await marcarSinRecarga(tablero);
    await marcarSinRecarga(ficha);

    // 5. El cliente (sin sesión, 360 px) abre el enlace y aprueba un trabajo.
    const cliente = await ctxCliente.newPage();
    await cliente.goto(`/p/${token}`);
    await expect(cliente.getByTestId("portal-estado")).toHaveText("Necesitamos tu OK");
    await lineaPortal(cliente, A).getByRole("button", { name: /^Aprobar/ }).click();
    await lineaPortal(cliente, A).getByRole("button", { name: "Sí, apruébalo" }).click();
    await expect(lineaPortal(cliente, A).getByTestId("portal-decision")).toContainText(/Aprobado el/, {
      timeout: 30_000,
    });

    // El taller lo ve sin recargar: aviso, chip del tablero, ficha e historial.
    await expect(aviso(tablero, `El cliente ha aprobado «${A}»`)).toBeVisible({ timeout: 15_000 });
    await expect(tarjeta).toContainText("Cliente: 1/3 decididos", { timeout: 15_000 });
    await expect(aviso(ficha, `El cliente ha aprobado «${A}»`)).toBeVisible({ timeout: 15_000 });
    const fichaA = lineas.filter({ hasText: A });
    await expect(fichaA.getByTestId("decision")).toHaveText("Aprobada", { timeout: 15_000 });
    await expect(fichaA).toContainText(new RegExp(`Decidida por el cliente el .*${FECHA.source}`));

    // 6. El cliente rechaza otro trabajo.
    await lineaPortal(cliente, B).getByRole("button", { name: /^Rechazar/ }).click();
    await lineaPortal(cliente, B).getByRole("button", { name: "Sí, recházalo" }).click();
    await expect(lineaPortal(cliente, B).getByTestId("portal-decision")).toContainText(/Rechazado el/, {
      timeout: 30_000,
    });

    await expect(aviso(tablero, `El cliente ha rechazado «${B}»`)).toBeVisible({ timeout: 15_000 });
    await expect(tarjeta).toContainText("Cliente: 2/3 decididos", { timeout: 15_000 });
    await expect(aviso(ficha, `El cliente ha rechazado «${B}»`)).toBeVisible({ timeout: 15_000 });
    const fichaB = lineas.filter({ hasText: B });
    await expect(fichaB.getByTestId("decision")).toHaveText("Rechazada", { timeout: 15_000 });
    await expect(fichaB).toContainText(new RegExp(`Decidida por el cliente el .*${FECHA.source}`));
    await expect(lineas.filter({ hasText: C }).getByTestId("decision")).toHaveText("Pendiente");
    await expect(ficha.getByTestId("total-aprobado")).toHaveText(/96,80/);

    const historial = ficha.getByRole("region", { name: "Historial" });
    await expect(historial.getByRole("listitem").filter({ hasText: `El cliente aprobó «${A}»` })).toHaveCount(1);
    await expect(historial.getByRole("listitem").filter({ hasText: `El cliente rechazó «${B}»` })).toHaveCount(1);

    // Nada de lo anterior ha necesitado recargar las páginas del taller.
    expect(await sigueSinRecargar(tablero)).toBe(true);
    expect(await sigueSinRecargar(ficha)).toBe(true);

    // El portal del cliente cabe en 360 px.
    expect(
      await cliente.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  } finally {
    await ctxCliente.close();
    await ctxTaller.close();
  }
});
