import { formatEuros } from "./format";
import { err, ok, type Result } from "./result";

/**
 * Formatea céntimos como euros ("45,50 €"). Canónico: `formatEuros`
 * (src/domain/format.ts); `formatCents` es solo un alias para no duplicar.
 */
export const formatCents = formatEuros;

/**
 * Límite de entrada: hasta 9 dígitos enteros (< 1.000.000.000 en euros o
 * unidades). Así importe * cantidad cabe de sobra en BigInt y el resultado en
 * un Number seguro.
 */
const DECIMAL_RE = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

function parseDecimal(
  raw: string,
  label: string,
): Result<{ int: number; frac: number }> {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return err(`${label}: introduce un valor`);
  if (text.startsWith("-")) return err(`${label}: no puede ser negativo`);
  const m = DECIMAL_RE.exec(text);
  if (!m) {
    if (/^\d+[.,]\d{3,}$/.test(text)) {
      return err(`${label}: máximo 2 decimales`);
    }
    return err(`${label}: formato no válido (usa por ejemplo 45,50)`);
  }
  const fracText = (m[2] ?? "").padEnd(2, "0");
  return ok({ int: Number(m[1]), frac: Number(fracText) });
}

/** "45,50" -> 4550. Parseo por cadena, sin coma flotante. */
export function parseEurosToCents(raw: string): Result<number> {
  const r = parseDecimal(raw, "Importe");
  if (!r.ok) return r;
  return ok(r.value.int * 100 + r.value.frac);
}

/** "1,5" -> 1500 (milésimas). Máximo 2 decimales; debe ser mayor que 0. */
export function parseQuantityToMilli(raw: string): Result<number> {
  const r = parseDecimal(raw, "Cantidad");
  if (!r.ok) return r;
  const milli = r.value.int * 1000 + r.value.frac * 10;
  if (milli <= 0) return err("Cantidad: debe ser mayor que 0");
  return ok(milli);
}
