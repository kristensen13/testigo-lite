import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Next solo sustituye `process.env.NEXT_PUBLIC_*` cuando se escribe con el
 * nombre literal, por eso no se pasa `process.env` entero.
 */
function readPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** Devuelve las variables públicas o lanza un error claro en castellano. */
export function getPublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse(readPublicEnv());
  if (!result.success) {
    throw new Error(
      "Faltan o no son válidas las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).",
    );
  }
  return result.data;
}

/** Igual que getPublicEnv, pero devuelve null en vez de lanzar. */
export function tryGetPublicEnv(): PublicEnv | null {
  const result = publicEnvSchema.safeParse(readPublicEnv());
  return result.success ? result.data : null;
}
