import type { SupabaseClient } from "@supabase/supabase-js";
import { parseChangeStatus } from "@/domain/order-detail";
import { canTransition, isOrderStatus } from "@/domain/order-status";

export type ChangeStatusResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const ERR_SERVIDOR = "No hemos podido cambiar el estado. Inténtalo de nuevo.";

/**
 * Núcleo de la acción de cambiar de estado: valida la entrada (zod), lee el
 * estado actual, comprueba la transición con el dominio y solo entonces hace el
 * update con la sesión del usuario. El evento del historial lo escriben los
 * triggers de la BD. El update exige que el estado siga siendo el leído para no
 * pisar un cambio concurrente.
 */
export async function changeOrderStatus(
  supabase: SupabaseClient,
  raw: Record<string, unknown>,
): Promise<ChangeStatusResult> {
  const parsed = parseChangeStatus(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { id, to } = parsed.value;

  const current = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (current.error) return { ok: false, error: ERR_SERVIDOR };
  if (!current.data || !isOrderStatus(current.data.status)) {
    return { ok: false, error: "No encontramos la orden." };
  }
  const from = current.data.status;
  if (!canTransition(from, to)) {
    return { ok: false, error: "Ese cambio de estado no está permitido." };
  }

  const updated = await supabase
    .from("orders")
    .update({ status: to })
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (updated.error) return { ok: false, error: ERR_SERVIDOR };
  if (!updated.data || updated.data.length === 0) {
    return { ok: false, error: "La orden ha cambiado mientras tanto. Recarga la ficha." };
  }
  return { ok: true, id };
}
