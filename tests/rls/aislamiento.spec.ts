import { expect, test } from "@playwright/test";
import {
  clienteUsuario,
  ORDER_WS2,
  PLATE_WS2,
  TABLES,
  WS1,
  WS2,
} from "./helpers";

type Fila = Record<string, unknown>;

const casos = [
  { usuario: 1 as const, propio: WS1, ajeno: WS2, matriculaAjena: "9999 ZZZ" },
  { usuario: 2 as const, propio: WS2, ajeno: WS1, matriculaAjena: "1234 ABC" },
];

for (const caso of casos) {
  test.describe(`RLS: aislamiento del usuario ${caso.usuario}`, () => {
    for (const tabla of TABLES) {
      test(`solo ve filas de su taller en ${tabla}`, async () => {
        const cliente = await clienteUsuario(caso.usuario);
        const { data, error } = await cliente.from(tabla).select("*");
        expect(error, `error al leer ${tabla}`).toBeNull();
        const filas = (data ?? []) as Fila[];

        if (tabla !== "public_links") {
          expect(filas.length, `${tabla} debería tener datos del seed`).toBeGreaterThan(0);
        }
        for (const fila of filas) {
          const taller = tabla === "workshops" ? fila.id : fila.workshop_id;
          expect(taller).toBe(caso.propio);
          expect(taller).not.toBe(caso.ajeno);
        }
      });
    }

    test("no ve la matrícula del otro taller", async () => {
      const cliente = await clienteUsuario(caso.usuario);
      const { data, error } = await cliente
        .from("vehicles")
        .select("plate, workshop_id");
      expect(error).toBeNull();
      const matriculas = (data ?? []).map((v) => v.plate);
      expect(matriculas).not.toContain(caso.matriculaAjena);
    });
  });
}

test.describe("RLS: usuario 1 frente al taller 2", () => {
  test("ninguna tabla expone la matrícula 9999 ZZZ", async () => {
    const cliente = await clienteUsuario(1);
    const vehiculos = await cliente.from("vehicles").select("id").eq("plate", PLATE_WS2);
    expect(vehiculos.error).toBeNull();
    expect(vehiculos.data).toHaveLength(0);

    const ordenes = await cliente.from("orders").select("id").eq("id", ORDER_WS2);
    expect(ordenes.error).toBeNull();
    expect(ordenes.data).toHaveLength(0);
  });

  test("no puede insertar una orden en el taller 2", async () => {
    const cliente = await clienteUsuario(1);
    const { error } = await cliente.from("orders").insert({
      workshop_id: WS2,
      customer_id: "10000000-0000-4000-8000-000000000011",
      vehicle_id: "20000000-0000-4000-8000-000000000011",
      complaint: "Intrusión E2E",
      km_in: 1,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  test("no puede actualizar órdenes del taller 2 (0 filas)", async () => {
    const cliente = await clienteUsuario(1);
    const { data, error } = await cliente
      .from("orders")
      .update({ complaint: "Modificada por intruso E2E" })
      .eq("workshop_id", WS2)
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Confirmación desde el propio taller 2: la orden sigue intacta.
    const dueno = await clienteUsuario(2);
    const { data: orden } = await dueno
      .from("orders")
      .select("complaint")
      .eq("id", ORDER_WS2)
      .single();
    expect(orden?.complaint).toBe("Revisión general.");
  });
});
