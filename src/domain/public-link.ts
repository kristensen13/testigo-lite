import { z } from "zod";
import { formatDateTime } from "./format";
import { err, ok, type Result } from "./result";

export type LinkInfo = { expiresAt: string; revokedAt: string | null };

export type LinkStatus =
  | { kind: "ninguno" }
  | { kind: "activo"; expiresAt: string }
  | { kind: "caducado" }
  | { kind: "revocado" };

/** Estado del último enlace de la orden a partir de sus fechas y la hora actual. */
export function linkStatus(link: LinkInfo | null, now: Date): LinkStatus {
  if (!link) return { kind: "ninguno" };
  if (link.revokedAt) return { kind: "revocado" };
  if (new Date(link.expiresAt).getTime() <= now.getTime()) return { kind: "caducado" };
  return { kind: "activo", expiresAt: link.expiresAt };
}

/** Texto visible (no depende solo del color). */
export function linkStatusText(status: LinkStatus): string {
  switch (status.kind) {
    case "ninguno":
      return "Sin enlace todavía";
    case "activo":
      return `Enlace activo hasta ${formatDateTime(status.expiresAt)}`;
    case "caducado":
      return "Enlace caducado";
    case "revocado":
      return "Enlace revocado";
  }
}

const hostSchema = z
  .string()
  .max(255)
  .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i, "Host no válido");

const protoSchema = z.enum(["http", "https"]);

const firstValue = (v: string | null | undefined): string =>
  (v ?? "").split(",")[0].trim();

/**
 * Origen (esquema + host) a partir de las cabeceras de la petición. Valida el
 * host de forma estricta (sin rutas, credenciales ni espacios).
 */
export function parseOrigin(input: {
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
}): Result<string> {
  const rawHost = firstValue(input.forwardedHost) || firstValue(input.host);
  const host = hostSchema.safeParse(rawHost);
  if (!host.success) return err("No hemos podido determinar la dirección de la aplicación.");
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host.data);
  const proto = protoSchema.safeParse(firstValue(input.forwardedProto).toLowerCase());
  return ok(`${proto.success ? proto.data : isLocal ? "http" : "https"}://${host.data}`);
}

/** URL completa del portal del cliente. */
export function buildPublicUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/p/${token}`;
}

/** Nombre de pila del cliente ("" si no hay). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Texto en castellano para enviar por WhatsApp. */
export function shareText(customerName: string, plate: string, url: string): string {
  const name = firstName(customerName);
  const hola = name ? `Hola ${name}` : "Hola";
  return `${hola}, aquí puedes ver el estado de tu coche (${plate}) y aprobar el presupuesto: ${url}`;
}
