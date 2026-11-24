import { z } from "zod";
import { formatCents, parseEurosToCents, parseQuantityToMilli } from "./money";
import { formatDateTime } from "./format";
import { lineBaseCents, orderTotals, type LineDecision } from "./totals";

export const LINE_KINDS = ["mano_de_obra", "recambio"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const KIND_LABELS: Record<LineKind, string> = {
  mano_de_obra: "Mano de obra",
  recambio: "Recambio",
};

export const DESCRIPTION_MAX = 200;
/** Límites de la BD (checks de order_lines). */
export const QTY_MILLI_MAX = 1_000_000;
export const PRICE_CENTS_MAX = 100_000_000;

export type LineField = "kind" | "description" | "qty" | "price";
export type LineErrors = Partial<Record<LineField, string>>;

/** Lo que escribe el usuario en el formulario (texto tal cual). */
export interface LineValues {
  kind: string;
  description: string;
  qty: string;
  price: string;
}

export const EMPTY_LINE_VALUES: LineValues = {
  kind: "mano_de_obra",
  description: "",
  qty: "",
  price: "",
};

/** Solo estos campos se leen del cliente; cualquier otro (importes, totales, decisión) se ignora. */
export function toLineValues(raw: Record<string, unknown>): LineValues {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    kind: str(raw.kind),
    description: str(raw.description),
    qty: str(raw.qty),
    price: str(raw.price),
  };
}

export const uuidSchema = z.uuid("El identificador no es válido");

const textSchema = z.object({
  kind: z.enum(LINE_KINDS, "Elige el tipo de línea"),
  description: z
    .string("Escribe una descripción")
    .trim()
    .min(1, "Escribe una descripción")
    .max(DESCRIPTION_MAX, `La descripción admite como máximo ${DESCRIPTION_MAX} caracteres`),
});

export interface LineInput {
  kind: LineKind;
  description: string;
  qtyMilli: number;
  unitPriceCents: number;
}

export type LineParse =
  | { ok: true; value: LineInput }
  | { ok: false; errors: LineErrors };

/** Valida el formulario de línea con zod y los parsers de dinero del dominio. */
export function parseLineValues(values: LineValues): LineParse {
  const errors: LineErrors = {};

  const text = textSchema.safeParse({ kind: values.kind, description: values.description });
  if (!text.success) {
    for (const issue of text.error.issues) {
      const key = issue.path[0];
      if ((key === "kind" || key === "description") && !errors[key]) errors[key] = issue.message;
    }
  }

  const qty = parseQuantityToMilli(values.qty);
  if (!qty.ok) errors.qty = qty.error;
  else if (qty.value > QTY_MILLI_MAX) errors.qty = "Cantidad: máximo 1.000";

  const price = parseEurosToCents(values.price);
  if (!price.ok) errors.price = price.error;
  else if (price.value <= 0) errors.price = "Importe: debe ser mayor que 0";
  else if (price.value > PRICE_CENTS_MAX) errors.price = "Importe: máximo 1.000.000 €";

  if (Object.keys(errors).length > 0 || !text.success || !qty.ok || !price.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      kind: text.data.kind,
      description: text.data.description,
      qtyMilli: qty.value,
      unitPriceCents: price.value,
    },
  };
}

/** Fila a insertar: solo las columnas con privilegio de insert (nunca decision, decided_at ni vat_bp). */
export function buildInsertRow(
  orderId: string,
  workshopId: string,
  input: LineInput,
  position: number,
) {
  return {
    order_id: orderId,
    workshop_id: workshopId,
    kind: input.kind,
    description: input.description,
    qty_milli: input.qtyMilli,
    unit_price_cents: input.unitPriceCents,
    position,
  };
}

/** Cambios a actualizar: solo columnas editables. */
export function buildUpdateRow(input: LineInput) {
  return {
    kind: input.kind,
    description: input.description,
    qty_milli: input.qtyMilli,
    unit_price_cents: input.unitPriceCents,
  };
}

/** Fila tal como llega de la BD. */
export interface OrderLineRow {
  id: string;
  kind: string;
  description: string;
  qty_milli: number;
  unit_price_cents: number;
  vat_bp: number;
  decision: string;
  decided_at: string | null;
  position: number;
}

const DECISION_LABELS: Record<LineDecision, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

function isDecision(v: string): v is LineDecision {
  return v === "pendiente" || v === "aprobada" || v === "rechazada";
}

function isKind(v: string): v is LineKind {
  return (LINE_KINDS as readonly string[]).includes(v);
}

/** 2500 -> "2,5"; 2000 -> "2". Aritmética entera (máx. 2 decimales). */
export function formatQuantity(milli: number): string {
  const int = Math.floor(milli / 1000);
  const hundredths = Math.round((milli % 1000) / 10);
  if (hundredths === 0) return String(int);
  const frac = String(hundredths).padStart(2, "0").replace(/0$/, "");
  return `${int},${frac}`;
}

/** 4550 -> "45,50" (para precargar el campo de edición). */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

export interface LineView {
  id: string;
  kindLabel: string;
  kind: LineKind;
  description: string;
  qtyText: string;
  unitPriceText: string;
  lineTotalText: string;
  decision: LineDecision;
  decisionLabel: string;
  locked: boolean;
  /** Fecha de la decisión del cliente, solo si existe. */
  decidedAtText: string | null;
  /** Valores para precargar el formulario de edición. */
  values: LineValues;
}

export function toLineView(row: OrderLineRow): LineView {
  const decision: LineDecision = isDecision(row.decision) ? row.decision : "pendiente";
  const kind: LineKind = isKind(row.kind) ? row.kind : "recambio";
  return {
    id: row.id,
    kind,
    kindLabel: KIND_LABELS[kind],
    description: row.description,
    qtyText: formatQuantity(row.qty_milli),
    unitPriceText: formatCents(row.unit_price_cents),
    lineTotalText: formatCents(lineBaseCents(row.qty_milli, row.unit_price_cents)),
    decision,
    decisionLabel: DECISION_LABELS[decision],
    locked: decision !== "pendiente",
    decidedAtText: row.decided_at ? formatDateTime(row.decided_at) : null,
    values: {
      kind,
      description: row.description,
      qty: formatQuantity(row.qty_milli),
      price: centsToInput(row.unit_price_cents),
    },
  };
}

export interface TotalsView {
  base: string;
  vat: string;
  total: string;
  approvedTotal: string;
}

/** Totales calculados siempre por el dominio a partir de las filas de la BD. */
export function totalsView(rows: OrderLineRow[]): TotalsView {
  const t = orderTotals(
    rows.map((r) => ({
      qty_milli: r.qty_milli,
      unit_price_cents: r.unit_price_cents,
      vat_bp: r.vat_bp,
      decision: isDecision(r.decision) ? r.decision : "pendiente",
    })),
  );
  return {
    base: formatCents(t.baseCents),
    vat: formatCents(t.vatCents),
    total: formatCents(t.totalCents),
    approvedTotal: formatCents(t.approvedTotalCents),
  };
}
