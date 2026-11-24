import { describe, expect, it } from "vitest";
import { normalizePlate } from "./plate";

describe("normalizePlate", () => {
  it.each([
    ["1234-bcd", "1234BCD"],
    ["  1234 bcd ", "1234BCD"],
    ["M-1234-AB", "M1234AB"],
    ["1234\tbcd\n", "1234BCD"],
    ["1234 - bcd", "1234BCD"],
    ["", ""],
    ["---", ""],
  ])("%j -> %j", (input, out) => {
    expect(normalizePlate(input)).toBe(out);
  });

  it("como la BD: solo quita espacios y guiones (otros separadores y acentos se conservan)", () => {
    expect(normalizePlate("1234.bcd")).toBe("1234.BCD");
    expect(normalizePlate("ñ-1")).toBe("Ñ1");
  });
});
