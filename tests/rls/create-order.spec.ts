import { expect, test } from "@playwright/test";
import { clienteUsuario, crearOrden, matriculaUnica, WS1 } from "./helpers";

test.describe("RLS: create_order", () => {
  test("crea cliente, vehículo y orden en el taller del usuario y reutiliza el vehículo", async () => {
    const cliente = await clienteUsuario(1);
    const plate = matriculaUnica();

    const primera = await crearOrden(cliente, { plate, name: "Cliente E2E Uno" });
    expect(primera.error).toBeNull();
    const ordenId = primera.data as string;

    const { data: orden } = await cliente
      .from("orders")
      .select("workshop_id, customer_id, vehicle_id, status")
      .eq("id", ordenId)
      .single();
    expect(orden?.workshop_id).toBe(WS1);
    expect(orden?.status).toBe("recibido");

    const { data: cli } = await cliente
      .from("customers")
      .select("workshop_id, name")
      .eq("id", orden?.customer_id)
      .single();
    expect(cli).toEqual({ workshop_id: WS1, name: "Cliente E2E Uno" });

    const { data: veh } = await cliente
      .from("vehicles")
      .select("workshop_id, plate_norm")
      .eq("id", orden?.vehicle_id)
      .single();
    expect(veh?.workshop_id).toBe(WS1);
    expect(veh?.plate_norm).toBe(plate);

    // Segunda orden con la misma matrícula escrita de otra forma.
    const otraForma = `${plate.slice(0, 5).toLowerCase()}-${plate.slice(5)}`;
    const segunda = await crearOrden(cliente, { plate: otraForma, name: "Cliente E2E Dos" });
    expect(segunda.error).toBeNull();
    const { data: orden2 } = await cliente
      .from("orders")
      .select("vehicle_id, customer_id")
      .eq("id", segunda.data as string)
      .single();
    expect(orden2?.vehicle_id).toBe(orden?.vehicle_id);
    expect(orden2?.customer_id).toBe(orden?.customer_id);

    const { data: vehiculos } = await cliente
      .from("vehicles")
      .select("id")
      .eq("plate_norm", plate);
    expect(vehiculos).toHaveLength(1);
  });

  test("lo creado en el taller 1 no es visible para el usuario 2", async () => {
    const u1 = await clienteUsuario(1);
    const plate = matriculaUnica();
    const orden = await crearOrden(u1, { plate });
    expect(orden.error).toBeNull();

    const u2 = await clienteUsuario(2);
    const { data } = await u2.from("vehicles").select("id").eq("plate_norm", plate);
    expect(data).toHaveLength(0);
    const { data: ordenes } = await u2.from("orders").select("id").eq("id", orden.data as string);
    expect(ordenes).toHaveLength(0);
  });
});
