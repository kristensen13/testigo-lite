"use server";

import { redirect } from "next/navigation";
import { parseLogin, type LoginErrors } from "@/domain/login";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  email: string;
  errors: LoginErrors;
  formError?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";

  const parsed = parseLogin({ email, password: formData.get("password") });
  if (!parsed.ok) return { email, errors: parsed.errors };

  let failed = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.value);
    failed = error !== null;
  } catch {
    return {
      email,
      errors: {},
      formError: "No hemos podido iniciar sesión. Inténtalo de nuevo.",
    };
  }
  if (failed) {
    // Mensaje genérico: no revela si el email existe.
    return { email, errors: {}, formError: "Email o contraseña incorrectos" };
  }
  redirect("/");
}
