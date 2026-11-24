"use server";

import { revalidatePath } from "next/cache";
import { ERR_GENERICO } from "@/domain/portal-decision";
import { createPortalClient } from "@/lib/portal";
import { decideLineCore, type DecideResult } from "@/lib/portal-decision";

/**
 * Server Action del portal. Entrada: { token, lineId, decision } y nada más
 * (se valida con zod en decideLineCore). Usa el cliente anónimo sin sesión.
 */
export async function decideLine(input: {
  token: string;
  lineId: string;
  decision: string;
}): Promise<DecideResult> {
  try {
    const result = await decideLineCore(createPortalClient(), {
      token: input?.token,
      lineId: input?.lineId,
      decision: input?.decision,
    });
    // El token ya está validado como 64 hex: es seguro usarlo en la ruta.
    if (result.ok) revalidatePath(`/p/${input.token}`);
    return result;
  } catch {
    return { ok: false, error: ERR_GENERICO };
  }
}
