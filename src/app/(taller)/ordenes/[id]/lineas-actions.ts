"use server";

import { revalidatePath } from "next/cache";
import { toLineValues, type LineErrors, type LineValues } from "@/domain/order-lines";
import { createLine, deleteLine, updateLine, type LineResult } from "@/lib/order-lines";
import { createClient } from "@/lib/supabase/server";

export type LineState = {
  values: LineValues;
  errors: LineErrors;
  formError?: string;
  /** true cuando la última operación terminó bien. */
  done?: boolean;
};

const ERR = "No hemos podido guardar el cambio. Inténtalo de nuevo.";

async function run(
  formData: FormData,
  op: (supabase: Awaited<ReturnType<typeof createClient>>, raw: Record<string, unknown>) => Promise<LineResult>,
): Promise<LineState> {
  const raw = Object.fromEntries(formData);
  const values = toLineValues(raw);
  let result: LineResult;
  try {
    result = await op(await createClient(), raw);
  } catch {
    return { values, errors: {}, formError: ERR };
  }
  if (!result.ok) return { values, errors: result.errors, formError: result.formError };
  // La ficha (totales incluidos) y el tablero (chips de líneas) deben reflejar el cambio.
  revalidatePath(`/ordenes/${result.orderId}`);
  revalidatePath("/");
  return { values, errors: {}, done: true };
}

export async function createLineAction(_prev: LineState, formData: FormData): Promise<LineState> {
  const state = await run(formData, createLine);
  // Alta correcta: el formulario vuelve a quedar vacío (conservando el tipo).
  return state.done ? { ...state, values: { ...state.values, description: "", qty: "", price: "" } } : state;
}

export async function updateLineAction(_prev: LineState, formData: FormData): Promise<LineState> {
  return run(formData, updateLine);
}

export async function deleteLineAction(_prev: LineState, formData: FormData): Promise<LineState> {
  return run(formData, deleteLine);
}
