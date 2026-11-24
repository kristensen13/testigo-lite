import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSearchTerms,
  countDecisions,
  type BoardOrder,
} from "@/domain/board";
import { isOrderStatus } from "@/domain/order-status";

/** Máximo de órdenes y de coincidencias previas que se cargan en el tablero. */
export const BOARD_LIMIT = 300;
const ID_LIMIT = 200;

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

/**
 * Órdenes del tablero con cliente, vehículo y decisiones de las líneas.
 * Número fijo de consultas, sin importar cuántas órdenes haya:
 *  - sin búsqueda: 1 (orders con relaciones embebidas);
 *  - con búsqueda: 3 (ids de vehicles y de customers que coinciden, en paralelo,
 *    y después orders filtrado por esos ids).
 * La sesión del usuario hace que RLS limite todo a su taller.
 */
export async function fetchBoardOrders(
  supabase: SupabaseClient,
  q: string,
): Promise<BoardOrder[]> {
  let query = supabase
    .from("orders")
    .select(
      "id, number, status, created_at, customers(name), vehicles(plate, make_model), order_lines(decision)",
    )
    .order("created_at", { ascending: false })
    .limit(BOARD_LIMIT);

  const { namePattern, platePattern } = buildSearchTerms(q);
  if (namePattern !== null) {
    const [vehicles, customers] = await Promise.all([
      platePattern === null
        ? Promise.resolve({ data: [] as { id: string }[], error: null })
        : supabase
            .from("vehicles")
            .select("id")
            .ilike("plate_norm", platePattern)
            .limit(ID_LIMIT),
      supabase.from("customers").select("id").ilike("name", namePattern).limit(ID_LIMIT),
    ]);
    if (vehicles.error) throw new Error(vehicles.error.message);
    if (customers.error) throw new Error(customers.error.message);

    const vehicleIds = (vehicles.data ?? []).map((v) => v.id);
    const customerIds = (customers.data ?? []).map((c) => c.id);
    const conditions: string[] = [];
    if (vehicleIds.length > 0) conditions.push(`vehicle_id.in.(${vehicleIds.join(",")})`);
    if (customerIds.length > 0) conditions.push(`customer_id.in.(${customerIds.join(",")})`);
    if (conditions.length === 0) return [];
    query = query.or(conditions.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as OrderRow[];
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
