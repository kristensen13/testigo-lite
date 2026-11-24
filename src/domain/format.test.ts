import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatEuros } from "./format";

const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("formatEuros", () => {
  it("formatea céntimos en es-ES", () => {
    expect(norm(formatEuros(8894))).toBe("88,94 €");
    expect(norm(formatEuros(0))).toBe("0,00 €");
    expect(norm(formatEuros(123456))).toBe("1234,56 €");
  });

  it("rechaza importes no enteros", () => {
    expect(() => formatEuros(10.5)).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("formatea fechas en castellano", () => {
    expect(formatDate("2026-03-05T12:00:00Z")).toMatch(/5 mar/);
    expect(formatDateTime("2026-03-05T12:30:00Z")).toMatch(/13:30/);
  });
});
