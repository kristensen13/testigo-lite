import { expect, test } from "@playwright/test";
import { clienteAnon, TABLES } from "./helpers";

test.describe("RLS: acceso anónimo", () => {
  for (const tabla of TABLES) {
    test(`anon no lee ni inserta en ${tabla}`, async () => {
      const anon = clienteAnon();

      const lectura = await anon.from(tabla).select("*");
      // Sin privilegios: error de permisos; con RLS sin políticas: 0 filas.
      if (!lectura.error) {
        expect(lectura.data ?? []).toHaveLength(0);
      }

      const insercion = await anon.from(tabla).insert({});
      expect(insercion.error, "anon no debe poder insertar").not.toBeNull();
    });
  }

  test("anon no puede ejecutar create_order", async () => {
    const { error } = await clienteAnon().rpc("create_order", {
      p_customer_name: "X",
      p_customer_phone: "1",
      p_plate: "E2EANON",
      p_make_model: "X",
      p_km: 1,
      p_complaint: "X",
    });
    expect(error).not.toBeNull();
  });
});
