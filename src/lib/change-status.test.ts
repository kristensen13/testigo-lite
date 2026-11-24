import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changeOrderStatus } from "./change-status";

const ID = "30000000-0000-4000-8000-000000000001";

/** Cliente falso: registra selects y updates; responde con el estado dado. */
function fakeClient(status: string | null, updateRows: unknown[] = [{ id: ID }]) {
  const log = { selects: 0, updates: [] as unknown[] };
  const client = {
    from() {
      const b: Record<string, unknown> = {};
      let isUpdate = false;
      b.select = () => {
        if (!isUpdate) log.selects++;
        return b;
      };
      b.update = (v: unknown) => {
        isUpdate = true;
        log.updates.push(v);
        return b;
      };
      b.eq = () => b;
      b.maybeSingle = () =>
        Promise.resolve({ data: status === null ? null : { status }, error: null });
      b.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: updateRows, error: null });
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, log };
}

describe("changeOrderStatus", () => {
  it("transición permitida: hace un update con el estado destino", async () => {
    const { client, log } = fakeClient("recibido");
    expect(await changeOrderStatus(client, { id: ID, to: "diagnostico" })).toEqual({ ok: true, id: ID });
    expect(log.updates).toEqual([{ status: "diagnostico" }]);
  });

  it("transición no adyacente: error y NO se llama al update", async () => {
    const { client, log } = fakeClient("recibido");
    const r = await changeOrderStatus(client, { id: ID, to: "listo" });
    expect(r.ok).toBe(false);
    expect(log.updates).toHaveLength(0);
  });

  it("Entregado es terminal y el mismo estado no es una transición", async () => {
    const a = fakeClient("entregado");
    expect((await changeOrderStatus(a.client, { id: ID, to: "listo" })).ok).toBe(false);
    const b = fakeClient("diagnostico");
    expect((await changeOrderStatus(b.client, { id: ID, to: "diagnostico" })).ok).toBe(false);
    expect(a.log.updates).toHaveLength(0);
    expect(b.log.updates).toHaveLength(0);
  });

  it("id mal formado o estado inválido: ni siquiera consulta", async () => {
    const { client, log } = fakeClient("recibido");
    expect((await changeOrderStatus(client, { id: "xx", to: "diagnostico" })).ok).toBe(false);
    expect((await changeOrderStatus(client, { id: ID, to: "nada" })).ok).toBe(false);
    expect(log.selects).toBe(0);
    expect(log.updates).toHaveLength(0);
  });

  it("orden inexistente (o de otro taller): error sin update", async () => {
    const { client, log } = fakeClient(null);
    const r = await changeOrderStatus(client, { id: ID, to: "diagnostico" });
    expect(r.ok).toBe(false);
    expect(log.updates).toHaveLength(0);
  });

  it("si el update no afecta a ninguna fila (cambio concurrente) devuelve error", async () => {
    const { client } = fakeClient("recibido", []);
    expect((await changeOrderStatus(client, { id: ID, to: "diagnostico" })).ok).toBe(false);
  });
});
