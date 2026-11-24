import { z } from "zod";

/** Esquema de las credenciales del formulario de acceso. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Escribe tu email")
    .max(254, "El email es demasiado largo")
    .pipe(z.email("Escribe un email válido, por ejemplo nombre@taller.es")),
  password: z
    .string()
    .min(1, "Escribe tu contraseña")
    .max(200, "La contraseña es demasiado larga"),
});

export type LoginErrors = { email?: string; password?: string };

export type LoginParse =
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; errors: LoginErrors };

/** Valida las credenciales y devuelve un error en castellano por campo. */
export function parseLogin(input: {
  email: unknown;
  password: unknown;
}): LoginParse {
  const parsed = loginSchema.safeParse({
    email: typeof input.email === "string" ? input.email : "",
    password: typeof input.password === "string" ? input.password : "",
  });
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors: LoginErrors = {};
  for (const issue of parsed.error.issues) {
    const campo = issue.path[0];
    if (campo === "email" && !errors.email) errors.email = issue.message;
    if (campo === "password" && !errors.password) errors.password = issue.message;
  }
  return { ok: false, errors };
}
