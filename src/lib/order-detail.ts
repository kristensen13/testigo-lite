import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid, type OrderEventRow } from "@/domain/order-detail";
import { isOrderStatus, type OrderStatus } from "@/domain/order-status";

type One<T> = T | T[] | null;

export interface OrderDetail {
  id: string;
  number: number;
  status: OrderStatus;
  complaint: string;
  kmIn: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  plate: string;
  makeModel: string;
  vehicleKm: number | null;
}

const first = <T>(rel: One<T>): T | null => (Array.isArray(rel) ? (rel[0] ?? null) : rel);

/**
 * Una consulta con cliente y vehículo embebidos. Devuelve null si el id no es
 * un uuid, si no existe o si RLS lo oculta (orden de otro taller).
 */
export async function fetchOrderDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<OrderDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, number, status, complaint, km_in, created_at, customers(name, phone), vehicles(plate, make_model, km)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !isOrderStatus(data.status)) return null;

  const customer = first(data.customers as One<{ name: string; phone: string }>);
  const vehicle = first(
    data.vehicles as One<{ plate: string; make_model: string; km: number }>,
  );
  return {
    id: data.id,
    number: data.number,
    status: data.status,
    complaint: data.complaint,
    kmIn: data.km_in,
    createdAt: data.created_at,
    customerName: customer?.name ?? "",
    customerPhone: customer?.phone ?? "",
    plate: vehicle?.plate ?? "",
    makeModel: vehicle?.make_model ?? "",
    vehicleKm: vehicle?.km ?? null,
  };
}

/** Segunda y última consulta de la ficha: eventos de la orden. */
export async function fetchOrderEvents(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderEventRow[]> {
  const { data, error } = await supabase
    .from("order_events")
    .select("id, type, from_status, to_status, actor, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderEventRow[];
}
