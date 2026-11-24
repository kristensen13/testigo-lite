"use server";

import { revalidatePath } from "next/cache";
import { changeOrderStatus } from "@/lib/change-status";
import { createClient } from "@/lib/supabase/server";

export type ChangeStatusState = { error?: string };

export async function changeStatusAction(
  _prev: ChangeStatusState,
  formData: FormData,
): Promise<ChangeStatusState> {
  let result;
  try {
    const supabase = await createClient();
    result = await changeOrderStatus(supabase, {
      id: formData.get("id"),
      to: formData.get("to"),
    });
  } catch {
    return { error: "No hemos podido cambiar el estado. Inténtalo de nuevo." };
  }
  if (!result.ok) return { error: result.error };

  // La ficha y el tablero deben reflejar el nuevo estado.
  revalidatePath(`/ordenes/${result.id}`);
  revalidatePath("/");
  return {};
}
