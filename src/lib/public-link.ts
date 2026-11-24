import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LinkInfo } from "@/domain/public-link";

const uuidSchema = z.uuid();

const ERR_ORDEN = "No encontramos la orden.";
const ERR_ID = "La orden no es válida";
export const ERR_SERVIDOR = "No hemos podido completar la operación. Inténtalo de nuevo.";

export type CreateLinkResult = { ok: true; token: string } | { ok: false; error: string };
export type RevokeLinkResult = { ok: true } | { ok: false; error: string };

/** Traduce el error de la RPC sin filtrar detalles internos. */
function translate(error: { message?: string }): string {
  return error.message === "orden no encontrada" ? ERR_ORDEN : ERR_SERVIDOR;
}

/**
 * Estado del último enlace de la orden: una consulta, solo las columnas
 * necesarias (nunca token_hash).
 */
export async function fetchLinkInfo(
  supabase: SupabaseClient,
  orderId: string,
): Promise<LinkInfo | null> {
  const { data, error } = await supabase
    .from("public_links")
    .select("expires_at, revoked_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0] as { expires_at: string; revoked_at: string | null } | undefined;
  return row ? { expiresAt: row.expires_at, revokedAt: row.revoked_at } : null;
}

/** Crea un enlace (TTL 7 días); revoca el anterior en la BD. */
export async function createLink(
  supabase: SupabaseClient,
  rawOrderId: unknown,
): Promise<CreateLinkResult> {
  const id = uuidSchema.safeParse(rawOrderId);
  if (!id.success) return { ok: false, error: ERR_ID };
  const { data, error } = await supabase.rpc("create_public_link", {
    p_order_id: id.data,
    p_ttl_days: 7,
  });
  if (error) return { ok: false, error: translate(error) };
  if (typeof data !== "string" || !/^[0-9a-f]{64}$/.test(data)) {
    return { ok: false, error: ERR_SERVIDOR };
  }
  return { ok: true, token: data };
}

export async function revokeLink(
  supabase: SupabaseClient,
  rawOrderId: unknown,
): Promise<RevokeLinkResult> {
  const id = uuidSchema.safeParse(rawOrderId);
  if (!id.success) return { ok: false, error: ERR_ID };
  const { error } = await supabase.rpc("revoke_public_link", { p_order_id: id.data });
  if (error) return { ok: false, error: translate(error) };
  return { ok: true };
}
