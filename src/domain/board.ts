import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "./order-status";
import { normalizePlate } from "./plate";

/** Parámetros de búsqueda del tablero (?q=...). Siempre se validan en el servidor. */
export const boardSearchSchema = z.object({
  q: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(80)),
});

/**
 * Valida los searchParams del tablero. Acepta el primer valor si llega repetido y
 * nunca falla: un valor inválido (p. ej. demasiado largo) equivale a "sin búsqueda".
 */
export function parseBoardSearch(raw: { q?: string | string[] | undefined }): string {
  const value = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  const parsed = boardSearchSchema.safeParse({ q: value ?? "" });
  return parsed.success ? parsed.data.q : "";
}

/** Escapa los comodines de LIKE/ILIKE (\ % _) para buscar el texto literal. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface SearchTerms {
  /** Texto del nombre escapado para ilike, o null si no hay búsqueda. */
  namePattern: string | null;
  /** Matrícula normalizada y escapada para ilike sobre plate_norm, o null. */
  platePattern: string | null;
}

/** Patrones ilike (con % a ambos lados) para nombre de cliente y matrícula. */
export function buildSearchTerms(q: string): SearchTerms {
  const text = q.replace(/\s+/g, " ").trim();
  if (text === "") return { namePattern: null, platePattern: null };
  const plate = normalizePlate(text);
  return {
    namePattern: `%${escapeLike(text)}%`,
    platePattern: plate === "" ? null : `%${escapeLike(plate)}%`,
  };
}

export interface DecisionCount {
  decided: number;
  total: number;
}

/** Líneas con decision distinta de 'pendiente' sobre el total de líneas. */
export function countDecisions(lines: readonly { decision: string }[]): DecisionCount {
  return {
    decided: lines.filter((l) => l.decision !== "pendiente").length,
    total: lines.length,
  };
}

/** Texto del chip del tablero, o null si no hay líneas decididas. */
export function decisionChipLabel({ decided, total }: DecisionCount): string | null {
  if (decided === 0 || total === 0) return null;
  return `Cliente: ${decided}/${total} decididos`;
}

/** Antigüedad en lenguaje natural ("hace 3 h", "hace 2 días"). */
export function ageLabel(createdAt: Date | string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(createdAt).getTime();
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "hace 1 día" : `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "hace 1 año" : `hace ${years} años`;
}

export interface BoardOrder {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  plate: string;
  makeModel: string;
  decisions: DecisionCount;
}

/** Agrupa por estado conservando el orden de entrada; siempre devuelve los 6 estados. */
export function groupByStatus<T extends { status: OrderStatus }>(
  orders: readonly T[],
): Record<OrderStatus, T[]> {
  const groups = Object.fromEntries(ORDER_STATUSES.map((s) => [s, [] as T[]])) as Record<
    OrderStatus,
    T[]
  >;
  for (const o of orders) groups[o.status].push(o);
  return groups;
}
