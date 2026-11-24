import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBoardOrders } from "./board";

/** Cliente falso que registra cada consulta (from) y responde con datos fijos. */
function fakeClient(tables: Record<string, unknown[]>) {
  const calls: { table: string; ops: string[]; executed: boolean }[] = [];
  const client = {
    from(table: string) {
      const call = { table, ops: [] as string[], executed: false };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "order", "limit", "ilike", "or"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push(`${op}:${args.join("|")}`);
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => unknown) => {
        call.executed = true;
        return resolve({ data: tables[table] ?? [], error: null });
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const ORDER = (i: number) => ({
  id: `o${i}`,
  number: i,
  status: "recibido",
  created_at: "2026-01-01T00:00:00Z",
  customers: { name: `Cliente ${i}` },
  vehicles: { plate: `000${i} AAA`, make_model: "Seat" },
  order_lines: [{ decision: "aprobada" }, { decision: "pendiente" }],
});

describe("fetchBoardOrders (sin N+1)", () => {
  it("sin búsqueda hace 1 consulta a orders con las líneas embebidas, con 2 o con 50 órdenes", async () => {
    for (const n of [2, 50]) {
      const { client, calls } = fakeClient({
        orders: Array.from({ length: n }, (_, i) => ORDER(i)),
      });
      const orders = await fetchBoardOrders(client, "");
      expect(orders).toHaveLength(n);
      expect(calls.filter((c) => c.executed)).toHaveLength(1);
      expect(calls[0].table).toBe("orders");
      expect(calls[0].ops[0]).toContain("order_lines(decision)");
      expect(orders[0].decisions).toEqual({ decided: 1, total: 2 });
    }
  });

  it("con búsqueda hace 3 consultas como máximo, también con muchas órdenes", async () => {
    const { client, calls } = fakeClient({
      vehicles: [{ id: "v1" }],
      customers: [{ id: "c1" }],
      orders: Array.from({ length: 40 }, (_, i) => ORDER(i)),
    });
    await fetchBoardOrders(client, "1234-abc");
    expect(calls.filter((c) => c.executed).map((c) => c.table).sort()).toEqual(["customers", "orders", "vehicles"]);
    const orders = calls.find((c) => c.table === "orders");
    expect(orders?.ops.some((o) => o.startsWith("or:vehicle_id.in.(v1),customer_id.in.(c1)"))).toBe(
      true,
    );
    const veh = calls.find((c) => c.table === "vehicles");
    expect(veh?.ops).toContain("ilike:plate_norm|%1234ABC%");
  });

  it("sin coincidencias previas no consulta orders", async () => {
    const { client, calls } = fakeClient({});
    expect(await fetchBoardOrders(client, "nadie")).toEqual([]);
    expect(calls.filter((c) => c.executed).map((c) => c.table)).not.toContain("orders");
  });
});
