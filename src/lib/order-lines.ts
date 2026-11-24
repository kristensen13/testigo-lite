import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildInsertRow,
  buildUpdateRow,
  parseLineValues,
  toLineValues,
  uuidSchema,
  type LineErrors,
  type OrderLineRow,
} from "@/domain/order-lines";

export type LineResult =
  | { ok: true; orderId: string }
  | { ok: false; errors: LineErrors; formError?: string };

const ERR_SERVIDOR = "No hemos podido guardar el cambio. Inténtalo de nuevo.";
export const ERR_DECIDIDA = "Esta línea ya está decidida por el cliente o no existe";

const fail = (formError: string, errors: LineErrors = {}): LineResult => ({
  ok: false,
  errors,
  formError,
});

/** Una sola consulta: las líneas de la orden por position (RLS limita al taller). */
export async function fetchOrderLines(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderLineRow[]> {
  const { data, error } = await supabase
    .from("order_lines")
    .select("id, kind, description, qty_milli, unit_price_cents, vat_bp, decision, decided_at, position")
    .eq("order_id", orderId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderLineRow[];
}

/**
 * Alta de línea. Solo lee orderId, kind, description, qty y price del cliente;
 * el workshop_id sale de la orden leída con RLS y la position es la siguiente.
 */
export async function createLine(
  supabase: SupabaseClient,
  raw: Record<string, unknown>,
): Promise<LineResult> {
  const orderId = uuidSchema.safeParse(raw.orderId);
  if (!orderId.success) return fail("La orden no es válida");
  const parsed = parseLineValues(toLineValues(raw));
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const order = await supabase
    .from("orders")
    .select("workshop_id")
    .eq("id", orderId.data)
    .maybeSingle();
  if (order.error) return fail(ERR_SERVIDOR);
  if (!order.data) return fail("No encontramos la orden.");

  const last = await supabase
    .from("order_lines")
    .select("position")
    .eq("order_id", orderId.data)
    .order("position", { ascending: false })
    .limit(1);
  if (last.error) return fail(ERR_SERVIDOR);
  const position = last.data && last.data.length > 0 ? Number(last.data[0].position) + 1 : 0;

  const inserted = await supabase
    .from("order_lines")
    .insert(buildInsertRow(orderId.data, order.data.workshop_id as string, parsed.value, position))
    .select("id");
  if (inserted.error || !inserted.data || inserted.data.length !== 1) return fail(ERR_SERVIDOR);
  return { ok: true, orderId: orderId.data };
}

/** Edición: solo líneas pendientes de esa orden; si no afecta a 1 fila, error. */
export async function updateLine(
  supabase: SupabaseClient,
  raw: Record<string, unknown>,
): Promise<LineResult> {
  const orderId = uuidSchema.safeParse(raw.orderId);
  const lineId = uuidSchema.safeParse(raw.lineId);
  if (!orderId.success || !lineId.success) return fail("La línea no es válida");
  const parsed = parseLineValues(toLineValues(raw));
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const updated = await supabase
    .from("order_lines")
    .update(buildUpdateRow(parsed.value))
    .eq("id", lineId.data)
    .eq("order_id", orderId.data)
    .eq("decision", "pendiente")
    .select("id");
  if (updated.error) return fail(ERR_SERVIDOR);
  if (!updated.data || updated.data.length !== 1) return fail(ERR_DECIDIDA);
  return { ok: true, orderId: orderId.data };
}

/** Borrado: solo líneas pendientes de esa orden; si no afecta a 1 fila, error. */
export async function deleteLine(
  supabase: SupabaseClient,
  raw: Record<string, unknown>,
): Promise<LineResult> {
  const orderId = uuidSchema.safeParse(raw.orderId);
  const lineId = uuidSchema.safeParse(raw.lineId);
  if (!orderId.success || !lineId.success) return fail("La línea no es válida");

  const deleted = await supabase
    .from("order_lines")
    .delete()
    .eq("id", lineId.data)
    .eq("order_id", orderId.data)
    .eq("decision", "pendiente")
    .select("id");
  if (deleted.error) return fail(ERR_SERVIDOR);
  if (!deleted.data || deleted.data.length !== 1) return fail(ERR_DECIDIDA);
  return { ok: true, orderId: orderId.data };
}
