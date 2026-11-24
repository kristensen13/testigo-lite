import { describe, expect, it } from "vitest";
import { lineBaseCents, orderTotals, type TotalsLine } from "./totals";

const line = (
  qty_milli: number,
  unit_price_cents: number,
  decision: TotalsLine["decision"] = "pendiente",
): TotalsLine => ({ qty_milli, unit_price_cents, vat_bp: 2100, decision });

describe("lineBaseCents", () => {
  it("3 x 1,5 h x 45,50 EUR = 204,75 EUR", () => {
    expect(lineBaseCents(4500, 4550)).toBe(20475);
  });
  it("redondea half-up en .5", () => {
    expect(lineBaseCents(500, 1)).toBe(1); // 0,5 -> 1
    expect(lineBaseCents(1500, 1)).toBe(2); // 1,5 -> 2
    expect(lineBaseCents(499, 1)).toBe(0);
  });
  it("no desborda con valores grandes", () => {
    // producto intermedio > 2^53 pero resultado exacto gracias a BigInt
    const q = 9_007_199;
    const p = 9_007_199_254;
    const exact = (BigInt(q) * BigInt(p) * BigInt(2) + BigInt(1000)) / BigInt(2000);
    expect(lineBaseCents(q, p)).toBe(Number(exact));
  });
});

describe("orderTotals", () => {
  it("orden sin líneas: todo 0", () => {
    expect(orderTotals([])).toEqual({
      baseCents: 0,
      vatCents: 0,
      totalCents: 0,
      approvedBaseCents: 0,
      approvedVatCents: 0,
      approvedTotalCents: 0,
    });
  });

  it("204,75 EUR de base: IVA 43,00 y total 247,75", () => {
    const t = orderTotals([line(4500, 4550)]);
    expect(t.baseCents).toBe(20475);
    expect(t.vatCents).toBe(4300); // 4299,75 -> 4300
    expect(t.totalCents).toBe(24775);
  });

  it("ejemplo T9: 2 h x 40,00 + 1 x 25,50 -> 105,50 / 22,16 / 127,66", () => {
    const t = orderTotals([line(2000, 4000), line(1000, 2550)]);
    expect(t.baseCents).toBe(10550);
    expect(t.vatCents).toBe(2216);
    expect(t.totalCents).toBe(12766);
  });

  it("IVA sobre la suma de bases, no por línea", () => {
    const t = orderTotals([line(1000, 2), line(1000, 2)]); // base 4, IVA .84 -> 1
    expect(t.baseCents).toBe(4);
    expect(t.vatCents).toBe(1);
    expect(t.totalCents).toBe(5);
  });

  it("total aprobado solo con líneas aprobadas", () => {
    const t = orderTotals([
      line(2000, 4000, "aprobada"),
      line(1000, 2550, "rechazada"),
      line(1000, 1000, "pendiente"),
    ]);
    expect(t.approvedBaseCents).toBe(8000);
    expect(t.approvedVatCents).toBe(1680);
    expect(t.approvedTotalCents).toBe(9680);
    expect(t.baseCents).toBe(11550);
  });

  it("sin líneas aprobadas el aprobado es 0", () => {
    expect(orderTotals([line(1000, 500)]).approvedTotalCents).toBe(0);
  });
});
