import { createClient } from "@/lib/supabase/server";

/** Nombre del taller del usuario con sesión (RLS limita a su propio taller). */
export async function getWorkshopName(): Promise<string | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("workshops(name)")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !data) return null;

  const rel = data.workshops as { name: string } | { name: string }[] | null;
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.name ?? null) : rel.name;
}
