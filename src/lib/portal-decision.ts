import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideErrorMessage,
  decideResponseSchema,
  decisionSummary,
  ERR_GENERICO,
  parseDecideInput,
  type ClientDecision,
} from "@/domain/portal-decision";

export type DecideResult =
  | { ok: true; decision: ClientDecision; decidedAt: string; summary: string }
  | { ok: false; error: string };

/**
 * Núcleo de decideLine: valida la entrada con zod, llama a portal_decide con
 * el cliente que se le pasa (anónimo y sin sesión) y traduce los errores.
 * Solo viajan token, línea y decisión: nunca importes ni estados. Una entrada
 * inválida no llega a la BD.
 */
export async function decideLineCore(
  supabase: SupabaseClient,
  raw: unknown,
): Promise<DecideResult> {
  const input = parseDecideInput(raw);
  if (!input.ok) return { ok: false, error: ERR_GENERICO };

  const { data, error } = await supabase.rpc("portal_decide", {
    p_token: input.value.token,
    p_line_id: input.value.lineId,
    p_decision: input.value.decision,
  });
  if (error) return { ok: false, error: decideErrorMessage(error.message) };

  const parsed = decideResponseSchema.safeParse(data);
  if (!parsed.success || parsed.data.id !== input.value.lineId) {
    return { ok: false, error: ERR_GENERICO };
  }
  return {
    ok: true,
    decision: parsed.data.decision,
    decidedAt: parsed.data.decided_at,
    summary: decisionSummary(parsed.data.decision, parsed.data.decided_at),
  };
}
