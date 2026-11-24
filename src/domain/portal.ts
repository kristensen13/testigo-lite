import { z } from "zod";
import { formatDateTime, formatEuros } from "./format";
import {
  CUSTOMER_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "./order-status";
import { lineTotalWithVatCents } from "./portal-decision";
import { err, ok, type Result } from "./result";
import { lineBaseCents, orderTotals, VAT_BP, type LineDecision } from "./totals";

/** Token del enlace: 32 bytes en hexadecimal minúscula (64 caracteres). */
const TOKEN_RE = /^[0-9a-f]{64}$/;

/** Valida la forma del token ANTES de consultar la BD. */
export function parsePortalToken(raw: unknown): Result<string> {
  if (typeof raw !== "string" || !TOKEN_RE.test(raw)) {
    return err("token no válido");
  }
  return ok(raw);
}

const isoDate = z.iso.datetime({ offset: true });

const lineSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["mano_de_obra", "recambio"]),
  description: z.string().min(1).max(500),
  qty_milli: z.number().int().positive().max(999_999_999),
  unit_price_cents: z.number().int().min(0).max(999_999_999),
  vat_bp: z.number().int().min(0).max(10_000),
  decision: z.enum(["pendiente", "aprobada", "rechazada"]),
  decided_at: isoDate.nullable(),
});

/**
 * Lista blanca EXACTA de portal_get (0002_portal.sql). Estricto: una clave
 * de más o una que falte invalida toda la respuesta.
 */
export const portalResponseSchema = z.strictObject({
  workshop: z.strictObject({
    name: z.string().min(1).max(120),
    phone: z.string().min(1).max(30),
  }),
  vehicle: z.strictObject({
    plate: z.string().min(1).max(30),
    make_model: z.string().max(120),
  }),
  status: z.enum(ORDER_STATUSES),
  expires_at: isoDate,
  lines: z.array(lineSchema).max(200),
});

export type PortalResponse = z.infer<typeof portalResponseSchema>;

export type StepState = "hecho" | "actual" | "pendiente";

export interface PortalStep {
  status: OrderStatus;
  label: string;
  state: StepState;
}

export type DecisionView = {
  decision: LineDecision;
  label: string;
  /** Fecha formateada si está decidida; null si no. */
  decidedAt: string | null;
};

export interface PortalLineView {
  id: string;
  kindLabel: string;
  description: string;
  qtyText: string;
  unitPrice: string;
  lineTotal: string;
  /** Importe de la línea con IVA incluido (el de la confirmación). */
  totalWithVat: string;
  /** Pendiente y con la orden en "Esperando aprobación": se pueden mostrar los botones. */
  canDecide: boolean;
  decision: DecisionView;
}

export interface PortalView {
  plate: string;
  makeModel: string;
  status: OrderStatus;
  statusLabel: string;
  /** Solo el estado "Necesitamos tu OK" pide atención al cliente. */
  needsAttention: boolean;
  steps: PortalStep[];
  lines: PortalLineView[];
  totals: {
    base: string;
    vat: string;
    total: string;
    approvedTotal: string;
  };
  vatPercentText: string;
  workshopName: string;
  workshopPhone: string;
  /** "tel:+34600..." o null si el teléfono no tiene dígitos. */
  telHref: string | null;
  expiresAt: string;
}

const DECISION_LABELS: Record<LineDecision, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobado",
  rechazada: "Rechazado",
};

const KIND_LABELS = {
  mano_de_obra: "Mano de obra",
  recambio: "Recambio",
} as const;

/** Estados para la tira de progreso, con su estado respecto al actual. */
export function progressSteps(current: OrderStatus): PortalStep[] {
  const at = ORDER_STATUSES.indexOf(current);
  return ORDER_STATUSES.map((status, i) => ({
    status,
    label: CUSTOMER_LABELS[status],
    state: i < at ? "hecho" : i === at ? "actual" : "pendiente",
  }));
}

/** 1500 -> "1,5"; 2000 -> "2"; 250 -> "0,25". Solo enteros, sin coma flotante. */
export function formatQuantity(qtyMilli: number): string {
  const int = Math.trunc(qtyMilli / 1000);
  const frac = String(qtyMilli % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return frac === "" ? String(int) : `${int},${frac}`;
}

/** "+34 600 123 456" -> "tel:+34600123456"; sin dígitos -> null. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits === "") return null;
  return `tel:${phone.trim().startsWith("+") ? "+" : ""}${digits}`;
}

/** Valida la respuesta de la RPC. null (o cualquier otra cosa) = no disponible. */
export function parsePortalResponse(raw: unknown): Result<PortalResponse> {
  const parsed = portalResponseSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err("respuesta no válida");
}

/** Prepara lo que se pinta: solo sale de aquí lo que está en el esquema. */
export function buildPortalView(data: PortalResponse): PortalView {
  const totals = orderTotals(data.lines);
  return {
    plate: data.vehicle.plate,
    makeModel: data.vehicle.make_model,
    status: data.status,
    statusLabel: CUSTOMER_LABELS[data.status],
    needsAttention: data.status === "esperando_aprobacion",
    steps: progressSteps(data.status),
    lines: data.lines.map((l) => ({
      id: l.id,
      kindLabel: KIND_LABELS[l.kind],
      description: l.description,
      qtyText: formatQuantity(l.qty_milli),
      unitPrice: formatEuros(l.unit_price_cents),
      lineTotal: formatEuros(lineBaseCents(l.qty_milli, l.unit_price_cents)),
      totalWithVat: formatEuros(lineTotalWithVatCents(l.qty_milli, l.unit_price_cents, l.vat_bp)),
      canDecide: data.status === "esperando_aprobacion" && l.decision === "pendiente",
      decision: {
        decision: l.decision,
        label: DECISION_LABELS[l.decision],
        decidedAt: l.decided_at ? formatDateTime(l.decided_at) : null,
      },
    })),
    totals: {
      base: formatEuros(totals.baseCents),
      vat: formatEuros(totals.vatCents),
      total: formatEuros(totals.totalCents),
      approvedTotal: formatEuros(totals.approvedTotalCents),
    },
    vatPercentText: `${VAT_BP / 100} %`,
    workshopName: data.workshop.name,
    workshopPhone: data.workshop.phone,
    telHref: telHref(data.workshop.phone),
    expiresAt: formatDateTime(data.expires_at),
  };
}

/** Respuesta cruda de la RPC -> vista, o null si no hay que mostrar nada. */
export function portalViewFromRpc(raw: unknown): PortalView | null {
  const parsed = parsePortalResponse(raw);
  return parsed.ok ? buildPortalView(parsed.value) : null;
}
