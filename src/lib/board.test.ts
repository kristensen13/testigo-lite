import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ID_LIMIT,
  OPEN_ORDERS_LIMIT,
  PREVIOUS_DELIVERED_LIMIT,
  RECENT_DELIVERED_LIMIT,
} from "@/domain/board-limits";
import { fetchBoard, fetchPreviousDelivered } from "./board";

type Row = Record<string, unknown>;
interface Call {
  table: string;
  ops: string[];
  executed: boolean;
}

/**
 * Cliente falso que registra cada consulta y evalúa eq/neq/gte/lt/order/limit
 * sobre las filas de la tabla (las demás operaciones solo se registran).
 */
function fakeClient(tables: Record<string, Row[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [], executed: false };
      calls.push(call);
      let rows = [...(tables[table] ?? [])];
      const builder: Record<string, unknown> = {};
      const record =
        (op: string, apply?: (...a: never[]) => void) =>
        (...args: unknown[]) => {
          call.ops.push(`${op}:${args.join("|")}`);
          apply?.(...(args as never[]));
          return builder;
        };
      builder.select = record("select");
      builder.ilike = record("ilike");
      builder.or = record("or");
      builder.eq = record("eq", ((c: string, v: unknown) => {
        rows = rows.filter((r) => r[c] === v);
      }) as never);
      builder.neq = record("neq", ((c: string, v: unknown) => {
        rows = rows.filter((r) => r[c] !== v);
      }) as never);
      builder.gte = record("gte", ((c: string, v: string) => {
        rows = rows.filter((r) => String(r[c]) >= v);
      }) as never);
      builder.lt = record("lt", ((c: string, v: string) => {
        rows = rows.filter((r) => String(r[c]) < v);
      }) as never);
      builder.order = record("order", ((c: string, o: { ascending: boolean }) => {
        const dir = o.ascending ? 1 : -1;
        rows.sort((a, b) => (String(a[c]) < String(b[c]) ? -dir : String(a[c]) > String(b[c]) ? dir : 0));
      }) as never);
      builder.limit = record("limit", ((n: number) => {
        rows = rows.slice(0, n);
      }) as never);
      builder.then = (resolve: (v: unknown) => unknown) => {
        call.executed = true;
        return resolve({ data: rows, error: null });
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const NOW = new Date("2026-06-30T12:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

const ORDER = (i: number, over: Row = {}): Row => ({
  id: `o${i}`,
  number: i,
  status: "recibido",
  created_at: iso(1),
  updated_at: iso(1),
  customers: { name: `Cliente ${i}` },
  vehicles: { plate: `000${i} AAA`, make_model: "Seat" },
  order_lines: [{ decision: "aprobada" }, { decision: "pendiente" }],
  ...over,
});

const delivered = (i: number, daysAgo: number): Row =>
  ORDER(i, { status: "entregado", created_at: iso(daysAgo + 5), updated_at: iso(daysAgo) });

const executed = (calls: Call[]) => calls.filter((c) => c.executed);

describe("fetchBoard: sin N+1", () => {
  it("sin búsqueda hace 3 consultas (abiertas, entregadas recientes, anteriores) con 2 o con 50 órdenes", async () => {
    for (const n of [2, 50]) {
      const { client, calls } = fakeClient({
        orders: Array.from({ length: n }, (_, i) => ORDER(i)),
      });
      const board = await fetchBoard(client, "", NOW);
      expect(board.orders).toHaveLength(n);
      expect(executed(calls)).toHaveLength(3);
      expect(calls.every((c) => c.table === "orders")).toBe(true);
      const lista = calls.find((c) => c.ops[0].includes("order_lines(decision)"));
      expect(lista?.ops[0]).toContain("customers(name)");
      expect(lista?.ops[0]).toContain("vehicles(plate, make_model)");
      expect(board.orders[0].decisions).toEqual({ decided: 1, total: 2 });
    }
  });

  it("con búsqueda hace 5 consultas, también con muchas órdenes", async () => {
    const { client, calls } = fakeClient({
      vehicles: [{ id: "v1" }],
      customers: [{ id: "c1" }],
      orders: Array.from({ length: 40 }, (_, i) => ORDER(i)),
    });
    await fetchBoard(client, "1234-abc", NOW);
    expect(
      executed(calls)
        .map((c) => c.table)
        .sort(),
    ).toEqual(["customers", "orders", "orders", "orders", "vehicles"]);
    const orderCalls = calls.filter((c) => c.table === "orders" && c.ops.some((o) => o.startsWith("or:")));
    expect(orderCalls).toHaveLength(2);
    for (const c of orderCalls) {
      expect(c.ops).toContain("or:vehicle_id.in.(v1),customer_id.in.(c1)");
    }
    const veh = calls.find((c) => c.table === "vehicles");
    expect(veh?.ops).toContain("ilike:plate_norm|%1234ABC%");
  });

  it("búsqueda sin coincidencias previas no consulta las listas de órdenes", async () => {
    const { client, calls } = fakeClient({});
    const board = await fetchBoard(client, "nadie", NOW);
    expect(board.orders).toEqual([]);
    const listas = executed(calls).filter((c) => c.table === "orders" && c.ops.some((o) => o.startsWith("order:")));
    expect(listas).toHaveLength(0);
  });
});

describe("fetchBoard: reglas del tablero", () => {
  it("separa abiertas y entregadas recientes, y excluye las anteriores al corte", async () => {
    const { client } = fakeClient({
      orders: [
        ORDER(1, { status: "listo" }),
        delivered(2, 10),
        delivered(3, 29),
        delivered(4, 31),
        delivered(5, 90),
      ],
    });
    const board = await fetchBoard(client, "", NOW);
    expect(board.orders.map((o) => o.id).sort()).toEqual(["o1", "o2", "o3"]);
    expect(board.hasPrevious).toBe(true);
  });

  it("sin entregadas anteriores hasPrevious es false", async () => {
    const { client } = fakeClient({ orders: [ORDER(1), delivered(2, 3)] });
    expect((await fetchBoard(client, "", NOW)).hasPrevious).toBe(false);
  });

  it("criterio 4: una orden activa antigua se devuelve aunque haya más de 300 más recientes", async () => {
    const recientes = Array.from({ length: RECENT_DELIVERED_LIMIT + 50 }, (_, i) => delivered(i + 10, 1));
    const activaAntigua = ORDER(1, {
      id: "antigua",
      status: "en_reparacion",
      created_at: iso(400),
      updated_at: iso(400),
    });
    const { client } = fakeClient({ orders: [...recientes, activaAntigua] });
    const board = await fetchBoard(client, "", NOW);
    expect(board.orders.some((o) => o.id === "antigua")).toBe(true);
    expect(board.recentTruncated).toBe(true);
    expect(board.openTruncated).toBe(false);
    expect(board.orders.filter((o) => o.status === "entregado")).toHaveLength(RECENT_DELIVERED_LIMIT);
  });

  it("las no entregadas van por created_at desc y las entregadas por updated_at desc", async () => {
    const { client, calls } = fakeClient({ orders: [ORDER(1)] });
    await fetchBoard(client, "", NOW);
    const abiertas = calls.find((c) => c.ops.includes("neq:status|entregado"));
    const recientes = calls.find((c) => c.ops.some((o) => o.startsWith("gte:updated_at|")));
    expect(abiertas?.ops).toContain("order:created_at|[object Object]");
    expect(recientes?.ops).toContain("order:updated_at|[object Object]");
    expect(recientes?.ops).toContain("eq:status|entregado");
    expect(recientes?.ops).toContain(`gte:updated_at|${new Date(NOW.getTime() - 30 * 86_400_000).toISOString()}`);
  });
});

describe("límites con aviso (criterio 5)", () => {
  it("límite + 1 abiertas: se avisa y se muestran exactamente 500", async () => {
    const { client, calls } = fakeClient({
      orders: Array.from({ length: OPEN_ORDERS_LIMIT + 1 }, (_, i) => ORDER(i)),
    });
    const board = await fetchBoard(client, "", NOW);
    expect(board.openTruncated).toBe(true);
    expect(board.recentTruncated).toBe(false);
    expect(board.orders).toHaveLength(OPEN_ORDERS_LIMIT);
    const abiertas = calls.find((c) => c.ops.includes("neq:status|entregado"));
    expect(abiertas?.ops).toContain(`limit:${OPEN_ORDERS_LIMIT + 1}`);
  });

  it("exactamente el límite: sin aviso", async () => {
    const { client } = fakeClient({
      orders: [
        ...Array.from({ length: OPEN_ORDERS_LIMIT }, (_, i) => ORDER(i)),
        ...Array.from({ length: RECENT_DELIVERED_LIMIT }, (_, i) => delivered(5000 + i, 2)),
      ],
    });
    const board = await fetchBoard(client, "", NOW);
    expect(board.openTruncated).toBe(false);
    expect(board.recentTruncated).toBe(false);
    expect(board.orders).toHaveLength(OPEN_ORDERS_LIMIT + RECENT_DELIVERED_LIMIT);
  });

  it("entregadas recientes: límite + 1 avisa solo de ellas", async () => {
    const { client } = fakeClient({
      orders: Array.from({ length: RECENT_DELIVERED_LIMIT + 1 }, (_, i) => delivered(i, 2)),
    });
    const board = await fetchBoard(client, "", NOW);
    expect(board.recentTruncated).toBe(true);
    expect(board.openTruncated).toBe(false);
    expect(board.orders).toHaveLength(RECENT_DELIVERED_LIMIT);
  });
});

describe("fetchPreviousDelivered", () => {
  it("lista solo las anteriores al corte, de más reciente a más antigua, en 1 consulta", async () => {
    const { client, calls } = fakeClient({
      orders: [ORDER(1), delivered(2, 10), delivered(3, 90), delivered(4, 45), delivered(5, 31)],
    });
    const r = await fetchPreviousDelivered(client, "", NOW);
    expect(r.orders.map((o) => o.id)).toEqual(["o5", "o4", "o3"]);
    expect(r.truncated).toBe(false);
    expect(executed(calls)).toHaveLength(1);
  });

  it("con búsqueda hace 3 consultas; sin coincidencias previas, no consulta órdenes", async () => {
    const { client, calls } = fakeClient({
      vehicles: [{ id: "v1" }],
      customers: [],
      orders: [delivered(1, 60)],
    });
    await fetchPreviousDelivered(client, "abc", NOW);
    expect(executed(calls)).toHaveLength(3);

    const vacio = fakeClient({});
    expect(await fetchPreviousDelivered(vacio.client, "nadie", NOW)).toEqual({
      orders: [],
      truncated: false,
      searchTruncated: false,
    });
    expect(executed(vacio.calls).some((c) => c.table === "orders")).toBe(false);
  });

  it("límite + 1: avisa y devuelve exactamente 200; con 200, sin aviso", async () => {
    const mas = fakeClient({
      orders: Array.from({ length: PREVIOUS_DELIVERED_LIMIT + 1 }, (_, i) => delivered(i, 40 + (i % 5))),
    });
    const r = await fetchPreviousDelivered(mas.client, "", NOW);
    expect(r.truncated).toBe(true);
    expect(r.orders).toHaveLength(PREVIOUS_DELIVERED_LIMIT);

    const justo = fakeClient({
      orders: Array.from({ length: PREVIOUS_DELIVERED_LIMIT }, (_, i) => delivered(i, 40)),
    });
    const r2 = await fetchPreviousDelivered(justo.client, "", NOW);
    expect(r2.truncated).toBe(false);
    expect(r2.orders).toHaveLength(PREVIOUS_DELIVERED_LIMIT);
  });
});

describe("búsqueda con demasiadas coincidencias (T16b)", () => {
  const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }));
  const orCond = (calls: Call[]) =>
    calls.find((c) => c.table === "orders" && c.ops.some((o) => o.startsWith("or:")))?.ops.find((o) =>
      o.startsWith("or:"),
    ) ?? "";
  const count = (s: string, p: string) => (s.match(new RegExp(`${p}[0-9]+`, "g")) ?? []).length;

  it("ID_LIMIT + 1 vehículos: señal, se piden ID_LIMIT + 1 filas y el filtro usa ID_LIMIT ids", async () => {
    const { client, calls } = fakeClient({
      vehicles: ids(ID_LIMIT + 1, "v"),
      customers: [],
      orders: [ORDER(1)],
    });
    const board = await fetchBoard(client, "a", NOW);
    expect(board.searchTruncated).toBe(true);
    expect(calls.find((c) => c.table === "vehicles")?.ops).toContain(`limit:${ID_LIMIT + 1}`);
    expect(calls.find((c) => c.table === "customers")?.ops).toContain(`limit:${ID_LIMIT + 1}`);
    const or = orCond(calls);
    expect(count(or, "v")).toBe(ID_LIMIT);
    expect(or).not.toContain(`v${ID_LIMIT}`);
    expect(executed(calls)).toHaveLength(5);
  });

  it("ID_LIMIT + 1 clientes: señal", async () => {
    const { client, calls } = fakeClient({
      vehicles: [],
      customers: ids(ID_LIMIT + 1, "c"),
      orders: [ORDER(1)],
    });
    const board = await fetchBoard(client, "a", NOW);
    expect(board.searchTruncated).toBe(true);
    expect(count(orCond(calls), "c")).toBe(ID_LIMIT);
  });

  it("frontera: exactamente ID_LIMIT coincidencias no da señal", async () => {
    const { client } = fakeClient({
      vehicles: ids(ID_LIMIT, "v"),
      customers: ids(ID_LIMIT, "c"),
      orders: [ORDER(1)],
    });
    expect((await fetchBoard(client, "a", NOW)).searchTruncated).toBe(false);
  });

  it("sin búsqueda nunca hay señal y no se consultan vehículos ni clientes", async () => {
    const { client, calls } = fakeClient({
      vehicles: ids(ID_LIMIT + 5, "v"),
      customers: ids(ID_LIMIT + 5, "c"),
      orders: [ORDER(1)],
    });
    expect((await fetchBoard(client, "", NOW)).searchTruncated).toBe(false);
    expect(executed(calls)).toHaveLength(3);
    expect(calls.some((c) => c.table === "vehicles" || c.table === "customers")).toBe(false);
  });

  it("vista de anteriores: señal con ID_LIMIT + 1, ninguna con ID_LIMIT o sin búsqueda; 3 y 1 consultas", async () => {
    const mas = fakeClient({ vehicles: ids(ID_LIMIT + 1, "v"), customers: [], orders: [delivered(1, 60)] });
    const r = await fetchPreviousDelivered(mas.client, "a", NOW);
    expect(r.searchTruncated).toBe(true);
    expect(r.orders).toHaveLength(1);
    expect(executed(mas.calls)).toHaveLength(3);
    expect(count(orCond(mas.calls), "v")).toBe(ID_LIMIT);

    const cli = fakeClient({ vehicles: [], customers: ids(ID_LIMIT + 1, "c"), orders: [delivered(1, 60)] });
    expect((await fetchPreviousDelivered(cli.client, "a", NOW)).searchTruncated).toBe(true);

    const justo = fakeClient({ vehicles: ids(ID_LIMIT, "v"), customers: ids(ID_LIMIT, "c"), orders: [] });
    expect((await fetchPreviousDelivered(justo.client, "a", NOW)).searchTruncated).toBe(false);

    const sin = fakeClient({ orders: [delivered(1, 60)] });
    const r2 = await fetchPreviousDelivered(sin.client, "", NOW);
    expect(r2.searchTruncated).toBe(false);
    expect(executed(sin.calls)).toHaveLength(1);
  });
});
