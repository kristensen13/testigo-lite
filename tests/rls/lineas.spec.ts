import { expect, test } from "@playwright/test";
import { clienteUsuario, crearOrden, matriculaUnica } from "./helpers";

test.describe("RLS: líneas de presupuesto y borrado de órdenes", () => {
  test("decision y decided_at no se pueden escribir; el resto de columnas sí", async () => {
    const cliente = await clienteUsuario(1);
    const orden = await crearOrden(cliente, { plate: matriculaUnica() });
    expect(orden.error).toBeNull();
    const orderId = orden.data as string;
    const { data: o } = await cliente.from("orders").select("workshop_id").eq("id", orderId).single();

    const base = {
      order_id: orderId,
      workshop_id: o?.workshop_id,
      kind: "recambio",
      description: "Línea E2E",
      qty_milli: 1000,
      unit_price_cents: 1000,
      position: 0,
    };

    // Insert permitido (decision por defecto 'pendiente').
    const ins = await cliente.from("order_lines").insert(base).select("id").single();
    expect(ins.error).toBeNull();
    const lineaId = ins.data?.id as string;

    try {
      // Insert con decision = 'aprobada': permission denied.
      const insMala = await cliente
        .from("order_lines")
        .insert({ ...base, decision: "aprobada" });
      expect(insMala.error?.code).toBe("42501");
      expect(insMala.error?.message).toContain("permission denied");

      // Update de decision y de decided_at: permission denied.
      const updDecision = await cliente
        .from("order_lines")
        .update({ decision: "aprobada" })
        .eq("id", lineaId);
      expect(updDecision.error?.code).toBe("42501");
      expect(updDecision.error?.message).toContain("permission denied");

      const updFecha = await cliente
        .from("order_lines")
        .update({ decided_at: new Date().toISOString() })
        .eq("id", lineaId);
      expect(updFecha.error?.code).toBe("42501");
      expect(updFecha.error?.message).toContain("permission denied");

      // Update de description y qty_milli: funciona.
      const upd = await cliente
        .from("order_lines")
        .update({ description: "Línea E2E editada", qty_milli: 2500 })
        .eq("id", lineaId)
        .select("description, qty_milli, decision, decided_at");
      expect(upd.error).toBeNull();
      expect(upd.data).toEqual([
        {
          description: "Línea E2E editada",
          qty_milli: 2500,
          decision: "pendiente",
          decided_at: null,
        },
      ]);
    } finally {
      await cliente.from("order_lines").delete().eq("id", lineaId);
    }
  });

  test("el taller no puede borrar una orden", async () => {
    const cliente = await clienteUsuario(1);
    const orden = await crearOrden(cliente, { plate: matriculaUnica() });
    expect(orden.error).toBeNull();
    const orderId = orden.data as string;

    const borrado = await cliente.from("orders").delete().eq("id", orderId).select("id");
    // Sin privilegio de delete: error de permisos (o, como mínimo, 0 filas).
    if (!borrado.error) {
      expect(borrado.data ?? []).toHaveLength(0);
    }

    const { data } = await cliente.from("orders").select("id").eq("id", orderId);
    expect(data).toHaveLength(1);
  });
});
