import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión y responde con una redirección 303 a /login. Al ser una
 * navegación de documento completa se descarta todo el estado del cliente
 * (caché del router incluida), así que "atrás" no puede mostrar datos.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Solo cierra esta sesión; las de otros dispositivos siguen activas.
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Si falla la red, igualmente se lleva al usuario a /login.
  }
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
