import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/** Cliente de Supabase para Server Components, Server Actions y route handlers. */
export async function createClient() {
  // Nota: en `next dev` aparece un aviso "blocking-prerender-current-time" (supabase-js lee
  // Date.now al validar la sesión). Es solo de la validación de desarrollo (esa pasada vuelve
  // a renderizar la ruta tras responder) y es inocuo: la ruta ya es dinámica por `cookies()`.
  // No se silencia con `await connection()`: hacía dinámico todo lo que usa este cliente y no
  // aportó nada medible. La latencia intermitente del refresco del tablero en E2E no venía de
  // ahí: se trazó fase a fase y es la conexión TLS nueva a Supabase (ver e2e/en-vivo.spec.ts).
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el
            // proxy ya refresca la sesión, así que se ignora.
          }
        },
      },
    },
  );
}
