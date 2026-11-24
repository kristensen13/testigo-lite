import { z } from "zod";
import { formatDateTime } from "./format";
import {
  canTransition,
  isOrderStatus,
  ORDER_STATUSES,
  workshopLabel,
  type OrderStatus,
} from "./order-status";

/** Entrada de la acción "cambiar de estado" (id de la orden y estado destino). */
export const changeStatusSchema = z.object({
  id: z.uuid("La orden no es válida"),
  to: z.enum(ORDER_STATUSES, "El estado no es válido"),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export type ChangeStatusParse =
  | { ok: true; value: ChangeStatusInput }
  | { ok: false; error: string };

export function parseChangeStatus(raw: Record<string, unknown>): ChangeStatusParse {
  const parsed = changeStatusSchema.safeParse({ id: raw.id, to: raw.to });
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
}

/** ¿Es un uuid válido? (para responder 404 antes de consultar la BD). */
export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export interface OrderEventRow {
  id: string;
  type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string;
  note: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  /** Fecha y hora legibles (Europe/Madrid). */
  when: string;
  /** ISO para el atributo datetime. */
  iso: string;
  title: string;
  actor: string;
}

const ACTORS: Record<string, string> = {
  taller: "Taller",
  cliente: "Cliente",
  sistema: "Sistema",
};

const statusText = (s: string | null): string =>
  s !== null && isOrderStatus(s) ? workshopLabel(s) : "—";

function eventTitle(e: OrderEventRow): string {
  switch (e.type) {
    case "creada":
      return `Orden creada en ${statusText(e.to_status)}`;
    case "estado":
      return `Estado: ${statusText(e.from_status)} → ${statusText(e.to_status)}`;
    case "decision":
      return e.note === "aprobada"
        ? "El cliente aprobó un trabajo"
        : e.note === "rechazada"
          ? "El cliente rechazó un trabajo"
          : "El cliente decidió sobre un trabajo";
    case "enlace_creado":
      return "Enlace para el cliente creado";
    case "enlace_revocado":
      return "Enlace para el cliente revocado";
    default:
      return "Evento";
  }
}

/** Historial en orden cronológico inverso (el más reciente primero). */
export function buildHistory(events: OrderEventRow[]): HistoryEntry[] {
  return events
    .map((e, index) => ({ e, index, t: new Date(e.created_at).getTime() }))
    // Desempate estable: a igual instante, el que se leyó después va primero.
    .sort((a, b) => b.t - a.t || b.index - a.index)
    .map(({ e }) => ({
      id: e.id,
      when: formatDateTime(e.created_at),
      iso: e.created_at,
      title: eventTitle(e),
      actor: ACTORS[e.actor] ?? "Sistema",
    }));
}

export interface StatusButton {
  to: OrderStatus;
  /** Texto del botón y nombre accesible. */
  label: string;
}

/** Botones de cambio de estado: solo las transiciones permitidas. */
export function statusButtons(from: OrderStatus): StatusButton[] {
  return ORDER_STATUSES.filter((to) => canTransition(from, to)).map((to) => ({
    to,
    label: `Pasar a ${workshopLabel(to)}`,
  }));
}
