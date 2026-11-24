"use server";

import { redirect } from "next/navigation";
import {
  parseNewOrder,
  toValues,
  type NewOrderErrors,
  type NewOrderValues,
} from "@/domain/new-order";
import { createClient } from "@/lib/supabase/server";

export type NewOrderState = {
  values: NewOrderValues;
  errors: NewOrderErrors;
  formError?: string;
};

const ERROR_SERVIDOR = "No hemos podido crear la orden. Inténtalo de nuevo.";

export async function createOrderAction(
  _prev: NewOrderState,
  formData: FormData,
): Promise<NewOrderState> {
  const values = toValues(Object.fromEntries(formData));
  const parsed = parseNewOrder(values);
  if (!parsed.ok) return { values, errors: parsed.errors };

  const v = parsed.value;
  let id: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_order", {
      p_customer_name: v.customerName,
      p_customer_phone: v.customerPhone,
      p_plate: v.plate,
      p_make_model: v.makeModel,
      p_km: v.km,
      p_complaint: v.complaint,
    });
    if (error || typeof data !== "string") {
      return { values, errors: {}, formError: ERROR_SERVIDOR };
    }
    id = data;
  } catch {
    return { values, errors: {}, formError: ERROR_SERVIDOR };
  }
  redirect(`/ordenes/${id}`);
}
