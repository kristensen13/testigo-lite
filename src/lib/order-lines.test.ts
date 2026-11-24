import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createLine, deleteLine, ERR_DECIDIDA, updateLine } from "./order-lines";

const ORDER = "30000000-0000-4000-8000-000000000001";
const LINE = "40000000-0000-4000-8000-000000000011";
const WS = "00000000-0000-4000-8000-000000000001";

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: [string, unknown][];
}

interface Respuestas {
  order?: { data: unknown; error: unknown };
  last?: { data: unknown; error: unknown };
  write?: { data: unknown; error: unknown };
}

/** Cliente de Supabase falso: registra cada consulta y devuelve respuestas fijas. */
function fake(r: Respuestas = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const result = () => {
        if (table === "orders") return r.order ?? { data: { workshop_id: WS }, error: null };
        if (call.op === "select") return r.last ?? { data: [], error: null };
        return r.write ?? { data: [{ id: LINE }], error: null };
      };
      const b: Record<string, unknown> = {};
      const chain = () => b;
      b.select = (cols?: string) => {
        void cols;
        return b;
      };
      b.insert = (p: unknown) => ((call.op = "insert"), (call.payload = p), b);
      b.update = (p: unknown) => ((call.op = "update"), (call.payload = p), b);
      b.delete = () => ((call.op = "delete"), b);
      b.eq = (c: string, v: unknown) => (call.filters.push([c, v]), b);
      b.order = chain;
      b.limit = chain;
      b.maybeSingle = () => Promise.resolve(result());
      b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(res, rej);
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const valid = { orderId: ORDER, kind: "mano_de_obra", description: "Revisión", qty: "2", price: "40,00" };

describe("createLine", () => {
  it("inserta solo las columnas permitidas, con la siguiente position", async () => {
    const { client, calls } = fake({ last: { data: [{ position: 4 }], error: null } });
    const r = await createLine(client, {
      ...valid,
      // Intentos del cliente de colar importes, totales, decisión o taller.
      unit_price_cents: 1,
      qty_milli: 1,
      total: "999",
      decision: "aprobada",
      decided_at: "2026-01-01",
      vat_bp: 0,
      workshop_id: "x",
    });
    expect(r.ok).toBe(true);
    const ins = calls.find((c) => c.op === "insert");
    expect(ins?.payload).toEqual({
      order_id: ORDER,
      workshop_id: WS,
      kind: "mano_de_obra",
      description: "Revisión",
      qty_milli: 2000,
      unit_price_cents: 4000,
      position: 5,
    });
    for (const k of ["decision", "decided_at", "vat_bp"]) {
      expect(Object.keys(ins?.payload as object)).not.toContain(k);
    }
  });

  it("primera línea: position 0", async () => {
    const { client, calls } = fake();
    await createLine(client, valid);
    expect((calls.find((c) => c.op === "insert")?.payload as { position: number }).position).toBe(0);
  });

  it("id mal formado o importes inválidos no llegan a la BD", async () => {
    for (const raw of [
      { ...valid, orderId: "no-uuid" },
      { ...valid, qty: "0" },
      { ...valid, qty: "-1" },
      { ...valid, qty: "1,234" },
      { ...valid, price: "0" },
      { ...valid, price: "-3" },
      { ...valid, price: "1,999" },
      { ...valid, description: "" },
      { ...valid, kind: "otro" },
    ]) {
      const { client, calls } = fake();
      const r = await createLine(client, raw);
      expect(r.ok).toBe(false);
      expect(calls).toHaveLength(0);
    }
  });

  it("devuelve errores por campo en castellano", async () => {
    const { client } = fake();
    const r = await createLine(client, { ...valid, qty: "0", price: "1,234" });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) {
      expect(r.errors.qty).toMatch(/mayor que 0/);
      expect(r.errors.price).toMatch(/2 decimales/);
    }
  });

  it("error de BD en el insert", async () => {
    const { client } = fake({ write: { data: null, error: { message: "x" } } });
    const r = await createLine(client, valid);
    expect(r.ok).toBe(false);
  });
});

describe("updateLine", () => {
  it("filtra por id, order_id y decision pendiente y solo envía columnas editables", async () => {
    const { client, calls } = fake();
    const r = await updateLine(client, { ...valid, lineId: LINE, decision: "aprobada", vat_bp: 5 });
    expect(r.ok).toBe(true);
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.filters).toEqual([
      ["id", LINE],
      ["order_id", ORDER],
      ["decision", "pendiente"],
    ]);
    expect(Object.keys(upd?.payload as object).sort()).toEqual(
      ["description", "kind", "qty_milli", "unit_price_cents"],
    );
  });

  it("si afecta 0 filas (línea decidida) devuelve error", async () => {
    const { client } = fake({ write: { data: [], error: null } });
    const r = await updateLine(client, { ...valid, lineId: LINE });
    expect(r).toEqual({ ok: false, errors: {}, formError: ERR_DECIDIDA });
  });

  it("id mal formado o importe inválido no llega a la BD", async () => {
    for (const raw of [{ ...valid, lineId: "x" }, { ...valid, lineId: LINE, price: "-1" }]) {
      const { client, calls } = fake();
      expect((await updateLine(client, raw)).ok).toBe(false);
      expect(calls).toHaveLength(0);
    }
  });
});

describe("deleteLine", () => {
  it("filtra por id, order_id y decision pendiente", async () => {
    const { client, calls } = fake();
    const r = await deleteLine(client, { orderId: ORDER, lineId: LINE });
    expect(r.ok).toBe(true);
    const del = calls.find((c) => c.op === "delete");
    expect(del?.filters).toEqual([
      ["id", LINE],
      ["order_id", ORDER],
      ["decision", "pendiente"],
    ]);
  });

  it("si afecta 0 filas devuelve error", async () => {
    const { client } = fake({ write: { data: [], error: null } });
    const r = await deleteLine(client, { orderId: ORDER, lineId: LINE });
    expect(r).toMatchObject({ ok: false, formError: ERR_DECIDIDA });
  });

  it("id mal formado no llega a la BD", async () => {
    const { client, calls } = fake();
    expect((await deleteLine(client, { orderId: ORDER, lineId: "1; drop" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
