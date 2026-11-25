import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { tryGetPublicEnv } from "@/lib/env";

/** Rutas accesibles sin sesión. Los estáticos quedan fuera por el matcher. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    isPortalPath(pathname)
  );
}

/** Portal del cliente: nunca usa la sesión del taller. */
export function isPortalPath(pathname: string): boolean {
  return pathname === "/p" || pathname.startsWith("/p/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // El portal no usa sesión: no se consulta a Supabase Auth (menos latencia) ni se emiten
  // cookies de sesión en él. Sus cabeceras las pone next.config.ts, no el proxy.
  if (isPortalPath(pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const env = tryGetPublicEnv();

  // Sin configuración de Supabase no hay sesión posible: no se rompe la app.
  let hasUser = false;
  if (env) {
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    try {
      // getUser valida el token con Supabase y refresca la sesión si hace falta.
      const { data } = await supabase.auth.getUser();
      hasUser = data.user !== null;
    } catch {
      hasUser = false;
    }
  }

  if (!hasUser && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Cache-Control", "no-store, max-age=0");
    return redirect;
  }

  // Las pantallas del taller y el login nunca se cachean (ni en el
  // navegador al volver atrás tras cerrar sesión).
  response.headers.set("Cache-Control", "no-store, max-age=0");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
