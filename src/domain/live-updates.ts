/**
 * Lógica pura de los avisos en vivo (Supabase Realtime): decide qué cambios
 * importan y cómo se muestran. Sin dependencias de Next ni de Supabase.
 */

export type LiveDecision = "aprobada" | "rechazada";

export type LiveNotice = {
  /** Identificador único del aviso en pantalla. */
  id: string;
  /** Línea a la que se refiere: un aviso nuevo de la misma línea sustituye al anterior. */
  lineId: string;
  text: string;
};

export type LiveChange = {
  /** Qué hay que hacer con el cambio. */
  refresh: boolean;
  notice: { lineId: string; text: string } | null;
};

const IGNORE: LiveChange = { refresh: false, notice: null };

/** Máximo de avisos apilados a la vez: al llegar uno más se descarta el más antiguo. */
export const MAX_NOTICES = 3;
/** Tiempo tras el cual un aviso se apaga solo. */
export const NOTICE_TTL_MS = 8000;
/** Espera para agrupar ráfagas antes de refrescar (una decisión da un UPDATE y un INSERT). */
export const REFRESH_DEBOUNCE_MS = 400;

const MAX_DESCRIPTION = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > MAX_DESCRIPTION ? `${clean.slice(0, MAX_DESCRIPTION - 1)}…` : clean;
}

/** Texto del aviso: solo el nombre del trabajo y la decisión (sin datos personales). */
export function noticeText(decision: LiveDecision, description: string): string {
  const verbo = decision === "aprobada" ? "aprobado" : "rechazado";
  return `El cliente ha ${verbo} «${shorten(description)}»`;
}

/**
 * Interpreta un cambio de Realtime.
 *
 * - `order_events` INSERT con `type = 'decision'`: refresca (historial), sin aviso
 *   (el evento no trae la descripción del trabajo). Cualquier otro tipo
 *   (`enlace_creado`, `enlace_revocado`, cambios de estado...) se ignora por completo.
 * - `order_lines` UPDATE con `decision` distinta de `pendiente`: solo puede venir
 *   de una decisión del cliente; refresca y avisa.
 * - Todo lo demás se ignora.
 */
export function interpretChange(table: string, eventType: string, row: unknown): LiveChange {
  if (!isRecord(row)) return IGNORE;

  if (table === "order_events") {
    if (eventType === "INSERT" && row.type === "decision") return { refresh: true, notice: null };
    return IGNORE;
  }

  if (table === "order_lines") {
    if (eventType !== "UPDATE") return IGNORE;
    const decision = row.decision;
    if (decision !== "aprobada" && decision !== "rechazada") return IGNORE;
    const { id, description } = row;
    if (typeof id !== "string" || typeof description !== "string") return { refresh: true, notice: null };
    return { refresh: true, notice: { lineId: id, text: noticeText(decision, description) } };
  }

  return IGNORE;
}

/** Añade un aviso: sustituye al de la misma línea y conserva solo los `MAX_NOTICES` más recientes. */
export function pushNotice(current: readonly LiveNotice[], next: LiveNotice): LiveNotice[] {
  return [...current.filter((n) => n.lineId !== next.lineId), next].slice(-MAX_NOTICES);
}

export function dismissNotice(current: readonly LiveNotice[], id: string): LiveNotice[] {
  return current.filter((n) => n.id !== id);
}
