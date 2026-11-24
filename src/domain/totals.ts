export type LineDecision = "pendiente" | "aprobada" | "rechazada";

export interface TotalsLine {
  qty_milli: number;
  unit_price_cents: number;
  vat_bp: number;
  decision: LineDecision;
}

export interface OrderTotals {
  baseCents: number;
  vatCents: number;
  totalCents: number;
  approvedBaseCents: number;
  approvedVatCents: number;
  approvedTotalCents: number;
}

/** IVA general: 21 % = 2100 puntos básicos. */
export const VAT_BP = 2100;

/** División entera half-up de enteros no negativos. */
function divRoundHalfUp(n: bigint, d: bigint): bigint {
  return (BigInt(2) * n + d) / (BigInt(2) * d);
}

/**
 * Base de una línea: qty_milli * unit_price_cents / 1000, half-up.
 * Usa BigInt, así que no desborda; con cantidades < 1e9 u. y precios
 * < 1e9 €, el resultado cabe en un Number seguro (< 2^53). Fuera de eso
 * se lanza RangeError (es un error de programación, no de entrada de usuario).
 */
export function lineBaseCents(qtyMilli: number, unitPriceCents: number): number {
  if (!Number.isSafeInteger(qtyMilli) || !Number.isSafeInteger(unitPriceCents)) {
    throw new RangeError("Cantidad e importe deben ser enteros seguros");
  }
  const r = divRoundHalfUp(BigInt(qtyMilli) * BigInt(unitPriceCents), BigInt(1000));
  if (r > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Importe fuera de rango");
  }
  return Number(r);
}

function sums(lines: TotalsLine[]) {
  let base = BigInt(0);
  for (const l of lines) base += BigInt(lineBaseCents(l.qty_milli, l.unit_price_cents));
  const vat = divRoundHalfUp(base * BigInt(VAT_BP), BigInt(10000));
  return { base: Number(base), vat: Number(vat), total: Number(base + vat) };
}

/** Totales de la orden: IVA sobre la suma de bases (half-up) y total aprobado aparte. */
export function orderTotals(lines: TotalsLine[]): OrderTotals {
  const all = sums(lines);
  const approved = sums(lines.filter((l) => l.decision === "aprobada"));
  return {
    baseCents: all.base,
    vatCents: all.vat,
    totalCents: all.total,
    approvedBaseCents: approved.base,
    approvedVatCents: approved.vat,
    approvedTotalCents: approved.total,
  };
}
