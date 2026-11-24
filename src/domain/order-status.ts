/** Mismos valores y orden que el check de orders.status y orders_guard (0001_init.sql). */
export const ORDER_STATUSES = [
  "recibido",
  "diagnostico",
  "esperando_aprobacion",
  "en_reparacion",
  "listo",
  "entregado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const WORKSHOP_LABELS: Record<OrderStatus, string> = {
  recibido: "Recibido",
  diagnostico: "Diagnóstico",
  esperando_aprobacion: "Esperando aprobación",
  en_reparacion: "En reparación",
  listo: "Listo",
  entregado: "Entregado",
};

export const CUSTOMER_LABELS: Record<OrderStatus, string> = {
  recibido: "Recibido",
  diagnostico: "En diagnóstico",
  esperando_aprobacion: "Necesitamos tu OK",
  en_reparacion: "En reparación",
  listo: "Listo para recoger",
  entregado: "Entregado",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export const workshopLabel = (s: OrderStatus): string => WORKSHOP_LABELS[s];
export const customerLabel = (s: OrderStatus): string => CUSTOMER_LABELS[s];

/**
 * Como orders_guard: solo un paso adelante o atrás; entregado es terminal.
 * Un mismo estado no es una transición.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "entregado") return false;
  const i = ORDER_STATUSES.indexOf(from);
  const j = ORDER_STATUSES.indexOf(to);
  if (i < 0 || j < 0) return false;
  return Math.abs(i - j) === 1;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((to) => canTransition(from, to));
}
