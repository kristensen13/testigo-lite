"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { buildPublicUrl, parseOrigin } from "@/domain/public-link";
import { createLink, ERR_SERVIDOR, revokeLink } from "@/lib/public-link";
import { createClient } from "@/lib/supabase/server";

export type EnlaceState = {
  /** URL completa; solo existe justo después de crear el enlace. */
  url?: string;
  error?: string;
  /** Última operación terminada bien. */
  done?: "creado" | "revocado";
};

export async function enlaceAction(_prev: EnlaceState, formData: FormData): Promise<EnlaceState> {
  const orderId = formData.get("orderId");
  const intent = formData.get("intent");
  try {
    const supabase = await createClient();
    if (intent === "revocar") {
      const r = await revokeLink(supabase, orderId);
      if (!r.ok) return { error: r.error };
      revalidatePath(`/ordenes/${String(orderId)}`);
      return { done: "revocado" };
    }
    if (intent !== "crear") return { error: ERR_SERVIDOR };

    const h = await headers();
    const origin = parseOrigin({
      forwardedHost: h.get("x-forwarded-host"),
      host: h.get("host"),
      forwardedProto: h.get("x-forwarded-proto"),
    });
    if (!origin.ok) return { error: origin.error };
    const r = await createLink(supabase, orderId);
    if (!r.ok) return { error: r.error };
    revalidatePath(`/ordenes/${String(orderId)}`);
    return { done: "creado", url: buildPublicUrl(origin.value, r.token) };
  } catch {
    return { error: ERR_SERVIDOR };
  }
}
