import { z } from "zod";

/**
 * Máximo de filas por respuesta de PostgREST/Supabase por defecto ("Max rows",
 * Project Settings > API). Si una consulta pide más, el servidor recorta en silencio.
 */
export const POSTGREST_DEFAULT_MAX_ROWS = 1000;

/*
 * RESTRICCIÓN: cada límite + 1 (lo que se pide con `fetchSize`) debe quedar por debajo
 * de POSTGREST_DEFAULT_MAX_ROWS; si no, nunca se vería la fila extra y no habría aviso.
 */

/** Máximo de órdenes no entregadas que carga el tablero. */
export const OPEN_ORDERS_LIMIT = 500;
/** Máximo de órdenes entregadas en los últimos 30 días que carga el tablero. */
export const RECENT_DELIVERED_LIMIT = 300;
/** Máximo de órdenes que carga la vista de entregadas anteriores. */
export const PREVIOUS_DELIVERED_LIMIT = 200;
/** Máximo de ids de vehículos y de clientes que se resuelven para una búsqueda. */
export const ID_LIMIT = 200;
/** Texto del aviso cuando la búsqueda llega a `ID_LIMIT` coincidencias. */
export const TOO_MANY_MATCHES_TEXT = "Hay demasiadas coincidencias, afina la búsqueda";
/** Días que una orden entregada sigue en el tablero por defecto. */
export const DELIVERED_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lista de la que se pueden recortar órdenes. */
export type BoardList = "abiertas" | "entregadas_recientes" | "entregadas_anteriores";

export const BOARD_LIST_LIMITS: Record<BoardList, number> = {
  abiertas: OPEN_ORDERS_LIMIT,
  entregadas_recientes: RECENT_DELIVERED_LIMIT,
  entregadas_anteriores: PREVIOUS_DELIVERED_LIMIT,
};

/**
 * Fecha de corte: las entregadas con `updated_at >= corte` son recientes y las
 * de `updated_at < corte` son anteriores. `now` se inyecta para poder probarlo.
 */
export function deliveredCutoff(now: Date): Date {
  return new Date(now.getTime() - DELIVERED_WINDOW_DAYS * DAY_MS);
}

/** ¿La entrega (updated_at) entra en el tablero por defecto? */
export function isRecentDelivery(updatedAt: Date | string, now: Date): boolean {
  return new Date(updatedAt).getTime() >= deliveredCutoff(now).getTime();
}

/**
 * Las consultas piden `límite + 1` filas; si llegan más de `límite` es que hay más
 * de las que se muestran. Devuelve exactamente `límite` filas como máximo.
 */
export function applyLimit<T>(
  rows: readonly T[],
  limit: number,
): { rows: T[]; truncated: boolean } {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

/** Filas que hay que pedir para saber si se supera el límite. */
export function fetchSize(limit: number): number {
  return limit + 1;
}

/** Aviso en castellano cuando una lista queda recortada por su límite. */
export function limitNoticeText(list: BoardList): string {
  const limit = BOARD_LIST_LIMITS[list];
  switch (list) {
    case "abiertas":
      return `Se muestran las ${limit} órdenes abiertas más recientes; hay más. Usa el buscador para encontrar una concreta.`;
    case "entregadas_recientes":
      return `Se muestran las ${limit} órdenes entregadas más recientes de los últimos ${DELIVERED_WINDOW_DAYS} días; hay más. Usa el buscador para encontrar una concreta.`;
    case "entregadas_anteriores":
      return `Se muestran las ${limit} entregadas anteriores más recientes; hay más. Usa el buscador para encontrar una concreta.`;
  }
}

/** Causas de aviso: listas recortadas y búsqueda con demasiadas coincidencias. */
export type NoticeCause = BoardList | "coincidencias";

/**
 * Avisos que toca mostrar, en orden (listas y, al final, coincidencias), sin duplicados
 * aunque coincidan varias causas.
 */
export function limitNotices(truncated: Partial<Record<NoticeCause, boolean>>): string[] {
  const order: BoardList[] = ["abiertas", "entregadas_recientes", "entregadas_anteriores"];
  const notices = order.filter((list) => truncated[list] === true).map(limitNoticeText);
  if (truncated.coincidencias === true) {
    notices.push(`${TOO_MANY_MATCHES_TEXT}. Se muestran los resultados de las primeras ${ID_LIMIT} coincidencias de vehículos y de clientes.`);
  }
  return notices;
}

/** Vista del tablero: la de siempre o la de entregadas hace más de 30 días. */
export type BoardView = "tablero" | "anteriores";

const viewSchema = z.literal("anteriores");

/** Solo se acepta `?entregadas=anteriores`; cualquier otro valor se ignora. */
export function parseBoardView(raw: { entregadas?: string | string[] | undefined }): BoardView {
  const value = Array.isArray(raw.entregadas) ? raw.entregadas[0] : raw.entregadas;
  return viewSchema.safeParse(value).success ? "anteriores" : "tablero";
}

/** Enlace "Ver entregadas anteriores", conservando la búsqueda. */
export function previousDeliveredHref(q: string): string {
  const params = new URLSearchParams({ entregadas: "anteriores" });
  if (q !== "") params.set("q", q);
  return `/?${params.toString()}`;
}

/** Enlace "Volver al tablero" (vista por defecto, sin búsqueda). */
export const BOARD_HREF = "/";
