import { describe, expect, it } from "vitest";
import { formatCents, parseEurosToCents, parseQuantityToMilli } from "./money";

describe("parseEurosToCents", () => {
  it.each([
    ["45,50", 4550],
    ["45.5", 4550],
    ["45", 4500],
    ["0,05", 5],
    ["  0 ", 0],
  ])("%s -> %d", (raw, cents) => {
    expect(parseEurosToCents(raw)).toEqual({ ok: true, value: cents });
  });

  it.each(["", "   ", "-5", "-0,10", "1,234", "abc", "1,2,3", "12 €", "1e3", ",5"])(
    "rechaza %j sin lanzar",
    (raw) => {
      const r = parseEurosToCents(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Importe/);
    },
  );

  it("0,10 + 0,20 = 0,30 en céntimos", () => {
    const a = parseEurosToCents("0,10");
    const b = parseEurosToCents("0,20");
    if (!a.ok || !b.ok) throw new Error("no debería fallar");
    expect(a.value + b.value).toBe(30);
    expect(formatCents(a.value + b.value)).toBe("0,30 €");
  });
});

describe("formatCents", () => {
  it("formatea céntimos", () => {
    expect(formatCents(4550)).toBe("45,50 €");
  });
});

describe("parseQuantityToMilli", () => {
  it.each([
    ["1,5", 1500],
    ["3", 3000],
    ["0,25", 250],
    ["2.75", 2750],
  ])("%s -> %d", (raw, milli) => {
    expect(parseQuantityToMilli(raw)).toEqual({ ok: true, value: milli });
  });

  it.each(["", "-1", "1,555", "0", "0,00", "x"])("rechaza %j", (raw) => {
    const r = parseQuantityToMilli(raw);
    expect(r.ok).toBe(false);
  });
});
