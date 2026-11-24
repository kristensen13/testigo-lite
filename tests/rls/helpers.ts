import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Datos fijos del seed.sql.
export const WS1 = "00000000-0000-4000-8000-000000000001";
export const WS2 = "00000000-0000-4000-8000-000000000002";
export const ORDER_WS2 = "30000000-0000-4000-8000-000000000011";
export const PLATE_WS2 = "9999 ZZZ";

export const TABLES = [
  "workshops",
  "profiles",
  "customers",
  "vehicles",
  "orders",
  "order_lines",
  "order_events",
  "public_links",
] as const;

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Los tests de RLS necesitan los valores reales en .env.local (URL y clave anónima de Supabase y las credenciales de los dos usuarios demo).`,
    );
  }
  return valor;
}

function nuevoCliente(): SupabaseClient {
  return createClient(
    requerida("NEXT_PUBLIC_SUPABASE_URL"),
    requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Cliente sin sesión (rol anon). */
export function clienteAnon(): SupabaseClient {
  return nuevoCliente();
}

const sesiones = new Map<1 | 2, Promise<SupabaseClient>>();

/**
 * Cliente con sesión del usuario 1 (taller 1) o 2 (taller 2). Se reutiliza la
 * sesión dentro de cada worker para no agotar el límite de inicios de sesión.
 */
export function clienteUsuario(n: 1 | 2): Promise<SupabaseClient> {
  let sesion = sesiones.get(n);
  if (!sesion) {
    sesion = iniciarSesion(n);
    sesiones.set(n, sesion);
  }
  return sesion;
}

async function iniciarSesion(n: 1 | 2): Promise<SupabaseClient> {
  const sufijo = n === 1 ? "" : "_2";
  const email = requerida(`E2E_EMAIL${sufijo}`);
  const password = requerida(`E2E_PASSWORD${sufijo}`);
  const cliente = nuevoCliente();
  const { error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      `No se pudo iniciar sesión con el usuario demo ${n}: ${error.message}. Revisa E2E_EMAIL${sufijo} y E2E_PASSWORD${sufijo} y que el usuario exista en Supabase.`,
    );
  }
  return cliente;
}

/** Matrícula única que empieza por E2E (máx. 20 caracteres). */
export function matriculaUnica(): string {
  const azar = Math.random().toString(36).slice(2, 6);
  return `E2E${Date.now().toString(36)}${azar}`.toUpperCase().slice(0, 18);
}

export interface DatosOrden {
  plate: string;
  name?: string;
}

export async function crearOrden(
  cliente: SupabaseClient,
  { plate, name = "Cliente E2E RLS" }: DatosOrden,
) {
  return cliente.rpc("create_order", {
    p_customer_name: name,
    p_customer_phone: "600 000 999",
    p_plate: plate,
    p_make_model: "Modelo E2E",
    p_km: 1000,
    p_complaint: "Orden creada por el test de RLS.",
  });
}
