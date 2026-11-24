import { expect, test } from "@playwright/test";
import { clienteUsuario } from "./helpers";

// Orden del seed del taller 1 (8642 STV) con la línea 1 ya aprobada.
const ORDEN = "30000000-0000-4000-8000-000000000006";
const LINEA_DECIDIDA = "40000000-0000-4000-8000-000000000061";

test("el taller no puede editar ni borrar una línea ya decidida", async () => {
  const cliente = await clienteUsuario(1);
  const columnas = "description, qty_milli, unit_price_cents, decision, decided_at";
  const antes = await cliente.from("order_lines").select(columnas).eq("id", LINEA_DECIDIDA).single();
  expect(antes.error).toBeNull();
  expect(antes.data?.decision).not.toBe("pendiente");

  const upd = await cliente
    .from("order_lines")
    .update({ description: "Descripción manipulada" })
    .eq("id", LINEA_DECIDIDA)
    .eq("order_id", ORDEN)
    .select("id");
  if (!upd.error) expect(upd.data ?? []).toHaveLength(0);

  const del = await cliente
    .from("order_lines")
    .delete()
    .eq("id", LINEA_DECIDIDA)
    .eq("order_id", ORDEN)
    .select("id");
  if (!del.error) expect(del.data ?? []).toHaveLength(0);

  const despues = await cliente.from("order_lines").select(columnas).eq("id", LINEA_DECIDIDA).single();
  expect(despues.data).toEqual(antes.data);
});
