import { createClient } from "@supabase/supabase-js";
import { parsePortalToken, portalViewFromRpc, type PortalView } from "@/domain/portal";
import { getPublicEnv } from "@/lib/env";

/**
 * Lee el portal con la clave anónima y SIN sesión ni cookies: lo que ve el
 * cliente no depende de que haya un taller con sesión en el mismo navegador.
 * Devuelve null si el token no es válido, no existe, está caducado o revocado
 * (casos indistinguibles) o si la respuesta no encaja en la lista blanca.
 * Un fallo de red o de la BD lanza (lo recoge error.tsx).
 */
export async function fetchPortal(rawToken: string): Promise<PortalView | null> {
  const token = parsePortalToken(rawToken);
  if (!token.ok) return null; // forma inválida: no se llama a la BD

  const env = getPublicEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.rpc("portal_get", { p_token: token.value });
  if (error) throw new Error("No se pudo consultar el portal");
  return portalViewFromRpc(data);
}
