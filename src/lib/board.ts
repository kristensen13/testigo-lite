import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSearchTerms,
  countDecisions,
  type BoardOrder,
} from "@/domain/board";
import {
  applyLimit,
  deliveredCutoff,
  fetchSize,
  ID_LIMIT,
  OPEN_ORDERS_LIMIT,
  PREVIOUS_DELIVERED_LIMIT,
  RECENT_DELIVERED_LIMIT,
} from "@/domain/board-limits";
import { isOrderStatus } from "@/domain/order-status";

const ORDER_COLUMNS =
  "id, number, status, created_at, customers(name), vehicles(plate, make_model), order_lines(decision)";

type One<T> = T | T[] | null;
interface OrderRow {
  id: string;
  number: number;
  status: string;
  created_at: string;
  customers: One<{ name: string }>;
  vehicles: One<{ plate: string; make_model: string | null }>;
  order_lines: { decision: string }[] | null;
}

function first<T>(rel: One<T>): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function toBoardOrders(rows: OrderRow[]): BoardOrder[] {
  const orders: BoardOrder[] = [];
  for (const r of rows) {
    if (!isOrderStatus(r.status)) continue;
    const customer = first(r.customers);
    const vehicle = first(r.vehicles);
    orders.push({
      id: r.id,
      number: r.number,
      status: r.status,
      createdAt: r.created_at,
      customerName: customer?.name ?? "",
      plate: vehicle?.plate ?? "",
      makeModel: vehicle?.make_model ?? "",
      decisions: countDecisions(r.order_lines ?? []),
    });
  }
  return orders;
}

interface SearchResolution {
  /** Condición `or`; "" si hay búsqueda pero nada coincide. */
  conditions: string;
  /** Vehículos o clientes llegaron a más de `ID_LIMIT` coincidencias. */
  truncated: boolean;
}

/**
 * Condición `or` de PostgREST con los ids de vehículos y clientes que coinciden con
 * la búsqueda: 2 consultas en paralelo, pidiendo `ID_LIMIT + 1` filas para detectar
 * el recorte (se usan como máximo `ID_LIMIT` ids). Devuelve null si no hay búsqueda.
 */
async function resolveSearch(supabase: SupabaseClient, q: string): Promise<SearchResolution | null> {
  const { namePattern, platePattern } = buildSearchTerms(q);
  if (namePattern === null) return null;
  const size = fetchSize(ID_LIMIT);
  const [vehicles, customers] = await Promise.all([
    platePattern === null
      ? Promise.resolve({ data: [] as { id: string }[], error: null })
      : supabase.from("vehicles").select("id").ilike("plate_norm", platePattern).limit(size),
    supabase.from("customers").select("id").ilike("name", namePattern).limit(size),
  ]);
  if (vehicles.error) throw new Error(vehicles.error.message);
  if (customers.error) throw new Error(customers.error.message);

  const v = applyLimit(vehicles.data ?? [], ID_LIMIT);
  const c = applyLimit(customers.data ?? [], ID_LIMIT);
  const conditions: string[] = [];
  if (v.rows.length > 0) conditions.push(`vehicle_id.in.(${v.rows.map((r) => r.id).join(",")})`);
  if (c.rows.length > 0) conditions.push(`customer_id.in.(${c.rows.map((r) => r.id).join(",")})`);
  return { conditions: conditions.join(","), truncated: v.truncated || c.truncated };
}

interface ListSpec {
  /** Filtro de estado: `neq` excluye entregadas, `eq` las selecciona. */
  status: { op: "eq" | "neq"; value: "entregado" };
  /** `updated_at >= gte` o `updated_at < lt`, para las entregadas. */
  gte?: string;
  lt?: string;
  orderBy: "created_at" | "updated_at";
  limit: number;
}

/** Ejecuta una consulta de órdenes pidiendo límite + 1 filas y recortando a límite. */
async function runList(
  supabase: SupabaseClient,
  spec: ListSpec,
  orConditions: string | null,
): Promise<{ orders: BoardOrder[]; truncated: boolean }> {
  let query = supabase.from("orders").select(ORDER_COLUMNS);
  query =
    spec.status.op === "eq"
      ? query.eq("status", spec.status.value)
      : query.neq("status", spec.status.value);
  if (spec.gte !== undefined) query = query.gte("updated_at", spec.gte);
  if (spec.lt !== undefined) query = query.lt("updated_at", spec.lt);
  query = query.order(spec.orderBy, { ascending: false }).limit(fetchSize(spec.limit));
  if (orConditions !== null) query = query.or(orConditions);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const { rows, truncated } = applyLimit((data ?? []) as unknown as OrderRow[], spec.limit);
  return { orders: toBoardOrders(rows), truncated };
}

export interface BoardData {
  /** No entregadas (created_at desc) y entregadas de los últimos 30 días (updated_at desc). */
  orders: BoardOrder[];
  openTruncated: boolean;
  recentTruncated: boolean;
  /** La búsqueda superó `ID_LIMIT` coincidencias de vehículos o de clientes. */
  searchTruncated: boolean;
  /** Existe al menos una entregada anterior al corte (sin tener en cuenta la búsqueda). */
  hasPrevious: boolean;
}

/**
 * Vista por defecto del tablero. Número fijo de consultas, sin importar cuántas
 * órdenes haya (RLS limita todo al taller de la sesión):
 *  - sin búsqueda: 3 (no entregadas, entregadas recientes, ¿hay anteriores?);
 *  - con búsqueda: 5 (se añaden las 2 de ids de vehículos y clientes).
 * Las no entregadas se piden aparte para que ninguna activa antigua quede
 * desplazada por las entregadas.
 */
export async function fetchBoard(
  supabase: SupabaseClient,
  q: string,
  now: Date,
): Promise<BoardData> {
  const cutoff = deliveredCutoff(now).toISOString();
  const search = await resolveSearch(supabase, q);

  const previousCheck = supabase
    .from("orders")
    .select("id")
    .eq("status", "entregado")
    .lt("updated_at", cutoff)
    .limit(1)
    .then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    });

  if (search !== null && search.conditions === "") {
    // Búsqueda sin coincidencias: no hay órdenes que consultar.
    return {
      orders: [],
      openTruncated: false,
      recentTruncated: false,
      searchTruncated: false,
      hasPrevious: await previousCheck,
    };
  }

  const [open, recent, hasPrevious] = await Promise.all([
    runList(
      supabase,
      {
        status: { op: "neq", value: "entregado" },
        orderBy: "created_at",
        limit: OPEN_ORDERS_LIMIT,
      },
      search?.conditions ?? null,
    ),
    runList(
      supabase,
      {
        status: { op: "eq", value: "entregado" },
        gte: cutoff,
        orderBy: "updated_at",
        limit: RECENT_DELIVERED_LIMIT,
      },
      search?.conditions ?? null,
    ),
    previousCheck,
  ]);

  return {
    orders: [...open.orders, ...recent.orders],
    openTruncated: open.truncated,
    recentTruncated: recent.truncated,
    searchTruncated: search?.truncated ?? false,
    hasPrevious,
  };
}

export interface PreviousDeliveredData {
  orders: BoardOrder[];
  truncated: boolean;
  /** La búsqueda superó `ID_LIMIT` coincidencias de vehículos o de clientes. */
  searchTruncated: boolean;
}

/**
 * Vista de entregadas anteriores (updated_at < corte), de más reciente a más antigua.
 * 1 consulta sin búsqueda; 3 con búsqueda.
 */
export async function fetchPreviousDelivered(
  supabase: SupabaseClient,
  q: string,
  now: Date,
): Promise<PreviousDeliveredData> {
  const cutoff = deliveredCutoff(now).toISOString();
  const search = await resolveSearch(supabase, q);
  if (search !== null && search.conditions === "") {
    return { orders: [], truncated: false, searchTruncated: false };
  }
  const list = await runList(
    supabase,
    {
      status: { op: "eq", value: "entregado" },
      lt: cutoff,
      orderBy: "updated_at",
      limit: PREVIOUS_DELIVERED_LIMIT,
    },
    search?.conditions ?? null,
  );
  return { ...list, searchTruncated: search?.truncated ?? false };
}
