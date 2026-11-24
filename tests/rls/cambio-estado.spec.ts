import { expect, test } from "@playwright/test";
import { clienteUsuario, crearOrden, matriculaUnica } from "./helpers";

test.describe("orders_guard: cambios de estado", () => {
  test("un estado no adyacente falla en la BD y no cambia nada; el adyacente añade evento", async () => {
    const cliente = await clienteUsuario(1);
    const creada = await crearOrden(cliente, { plate: matriculaUnica() });
    expect(creada.error).toBeNull();
    const id = creada.data as string;

    const salto = await cliente.from("orders").update({ status: "listo" }).eq("id", id).select("id");
    expect(salto.error).not.toBeNull();

    const { data: tras } = await cliente.from("orders").select("status").eq("id", id).single();
    expect(tras?.status).toBe("recibido");

    const paso = await cliente.from("orders").update({ status: "diagnostico" }).eq("id", id).select("id");
    expect(paso.error).toBeNull();
    const { data: eventos } = await cliente
      .from("order_events")
      .select("type, from_status, to_status, actor")
      .eq("order_id", id)
      .eq("type", "estado");
    expect(eventos).toEqual([
      { type: "estado", from_status: "recibido", to_status: "diagnostico", actor: "taller" },
    ]);
  });
});
