import { describe, expect, it } from "vitest";
import {
  buildInsertRow,
  buildUpdateRow,
  centsToInput,
  formatQuantity,
  parseLineValues,
  toLineValues,
  toLineView,
  totalsView,
  type OrderLineRow,
} from "./order-lines";

const ok = { kind: "mano_de_obra", description: "Cambio de aceite", qty: "2", price: "40,00" };

const row = (o: Partial<OrderLineRow>): OrderLineRow => ({
  id: "a",
  kind: "recambio",
  description: "x",
  qty_milli: 1000,
  unit_price_cents: 1000,
  vat_bp: 2100,
  decision: "pendiente",
  decided_at: null,
  position: 0,
  ...o,
});

describe("parseLineValues", () => {
  it("convierte cantidad y precio a enteros", () => {
    const r = parseLineValues(ok);
    expect(r).toEqual({
      ok: true,
      value: { kind: "mano_de_obra", description: "Cambio de aceite", qtyMilli: 2000, unitPriceCents: 4000 },
    });
  });

  it.each(["0", "-1", "1,234", ""])("rechaza cantidad %j", (qty) => {
    const r = parseLineValues({ ...ok, qty });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.qty).toBeTruthy();
  });

  it.each(["0", "-5", "10,999", "", "abc"])("rechaza precio %j", (price) => {
    const r = parseLineValues({ ...ok, price });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.price).toBeTruthy();
  });

  it("rechaza descripción vacía, demasiado larga y tipo inválido", () => {
    expect(parseLineValues({ ...ok, description: "   " }).ok).toBe(false);
    const largo = parseLineValues({ ...ok, description: "a".repeat(201) });
    expect(largo.ok).toBe(false);
    const tipo = parseLineValues({ ...ok, kind: "otro" });
    expect(tipo.ok).toBe(false);
    if (!tipo.ok) expect(tipo.errors.kind).toBeTruthy();
    expect(parseLineValues({ ...ok, description: "a".repeat(200) }).ok).toBe(true);
  });

  it("respeta los límites de la BD", () => {
    expect(parseLineValues({ ...ok, qty: "1001" }).ok).toBe(false);
    expect(parseLineValues({ ...ok, price: "1000000,01" }).ok).toBe(false);
    expect(parseLineValues({ ...ok, qty: "1000", price: "1000000" }).ok).toBe(true);
  });
});

describe("filas a escribir", () => {
  const input = { kind: "recambio" as const, description: "d", qtyMilli: 1000, unitPriceCents: 2550 };
  it("insert: solo columnas permitidas", () => {
    expect(Object.keys(buildInsertRow("o", "w", input, 3)).sort()).toEqual(
      ["order_id", "workshop_id", "kind", "description", "qty_milli", "unit_price_cents", "position"].sort(),
    );
  });
  it("update: solo columnas editables", () => {
    expect(Object.keys(buildUpdateRow(input)).sort()).toEqual(
      ["kind", "description", "qty_milli", "unit_price_cents"].sort(),
    );
  });
  it("toLineValues ignora importes, totales y decisión", () => {
    expect(
      Object.keys(toLineValues({ ...ok, total: "1", unit_price_cents: 1, decision: "aprobada" })).sort(),
    ).toEqual(["description", "kind", "price", "qty"]);
  });
});

describe("vista", () => {
  it("formatea cantidad y precio", () => {
    expect(formatQuantity(2000)).toBe("2");
    expect(formatQuantity(2500)).toBe("2,5");
    expect(formatQuantity(1250)).toBe("1,25");
    expect(centsToInput(4000)).toBe("40,00");
    expect(centsToInput(2550)).toBe("25,50");
  });

  it("línea pendiente editable y decidida bloqueada", () => {
    const p = toLineView(row({ qty_milli: 2000, unit_price_cents: 4000, kind: "mano_de_obra" }));
    expect(p.locked).toBe(false);
    expect(p.decisionLabel).toBe("Pendiente");
    expect(p.kindLabel).toBe("Mano de obra");
    expect(p.lineTotalText).toContain("80,00");
    const d = toLineView(row({ decision: "aprobada", decided_at: "2026-01-02T10:00:00Z" }));
    expect(d.locked).toBe(true);
    expect(d.decisionLabel).toBe("Aprobada");
    expect(d.decidedAtText).toContain("2026");
    expect(toLineView(row({ decision: "rechazada", decided_at: "2026-01-02T10:00:00Z" })).decisionLabel).toBe(
      "Rechazada",
    );
  });

  it("totales del criterio 1: base 105,50, IVA 22,16, total 127,66", () => {
    const t = totalsView([
      row({ kind: "mano_de_obra", qty_milli: 2000, unit_price_cents: 4000 }),
      row({ qty_milli: 1000, unit_price_cents: 2550 }),
    ]);
    expect(t.base).toContain("105,50");
    expect(t.vat).toContain("22,16");
    expect(t.total).toContain("127,66");
    expect(t.approvedTotal).toContain("0,00");
  });

  it("total aprobado solo cuenta las aprobadas", () => {
    const t = totalsView([
      row({ qty_milli: 1000, unit_price_cents: 10000, decision: "aprobada", decided_at: "2026-01-01T00:00:00Z" }),
      row({ qty_milli: 1000, unit_price_cents: 5000 }),
    ]);
    expect(t.approvedTotal).toContain("121,00");
    expect(t.total).toContain("181,50");
  });
});
