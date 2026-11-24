import { describe, expect, it } from "vitest";
import {
  confirmationQuestion,
  decideErrorMessage,
  decisionSummary,
  lineTotalWithVatCents,
  parseDecideInput,
} from "./portal-decision";

const TOKEN = "ab".repeat(32);
const LINE = "11111111-1111-4111-8111-111111111111";

describe("lineTotalWithVatCents", () => {
  it("2 h x 40,00 € -> 96,80 € con IVA", () => {
    expect(lineTotalWithVatCents(2000, 4000)).toBe(9680);
  });
  it("1 x 25,50 € -> 30,86 € (IVA 5,355 redondeado half-up)", () => {
    expect(lineTotalWithVatCents(1000, 2550)).toBe(3086);
  });
  it("redondea half-up en el medio céntimo", () => {
    // base 50 -> IVA 10,5 -> 11
    expect(lineTotalWithVatCents(1000, 50)).toBe(61);
    // base 0 -> 0
    expect(lineTotalWithVatCents(1000, 0)).toBe(0);
  });
  it("cantidades fraccionarias: 1,5 h x 45,00 € = 67,50 + 14,175 -> 81,68", () => {
    expect(lineTotalWithVatCents(1500, 4500)).toBe(8168);
  });
  it("devuelve siempre un entero", () => {
    for (const [q, p] of [[333, 777], [1, 1], [999_999, 99_999]]) {
      expect(Number.isInteger(lineTotalWithVatCents(q, p))).toBe(true);
    }
  });
});

describe("parseDecideInput", () => {
  it("acepta token, uuid y decisión válidos", () => {
    expect(parseDecideInput({ token: TOKEN, lineId: LINE, decision: "aprobada" })).toEqual({
      ok: true,
      value: { token: TOKEN, lineId: LINE, decision: "aprobada" },
    });
  });
  it("rechaza token, línea o decisión inválidos", () => {
    expect(parseDecideInput({ token: "x", lineId: LINE, decision: "aprobada" }).ok).toBe(false);
    expect(parseDecideInput({ token: TOKEN.toUpperCase(), lineId: LINE, decision: "aprobada" }).ok).toBe(false);
    expect(parseDecideInput({ token: TOKEN, lineId: "no", decision: "aprobada" }).ok).toBe(false);
    expect(parseDecideInput({ token: TOKEN, lineId: LINE, decision: "pendiente" }).ok).toBe(false);
    expect(parseDecideInput(null).ok).toBe(false);
  });
  it("no acepta importes ni estados del cliente", () => {
    expect(
      parseDecideInput({ token: TOKEN, lineId: LINE, decision: "aprobada", amount: 1 }).ok,
    ).toBe(false);
    expect(
      parseDecideInput({ token: TOKEN, lineId: LINE, decision: "aprobada", status: "listo" }).ok,
    ).toBe(false);
  });
});

describe("decideErrorMessage", () => {
  it("traduce los códigos estables", () => {
    expect(decideErrorMessage("enlace_no_valido")).toBe("Este enlace ya no está disponible");
    expect(decideErrorMessage("orden_no_esperando_aprobacion")).toMatch(/todavía no espera tu respuesta/);
    expect(decideErrorMessage("linea_ya_decidida")).toBe("Este trabajo ya tiene una respuesta");
    expect(decideErrorMessage("linea_no_encontrada")).toMatch(/No encontramos/);
  });
  it("lo desconocido da un mensaje genérico sin detalles", () => {
    for (const c of ["decision_invalida", "FetchError: ECONNRESET", "", undefined, 42]) {
      expect(decideErrorMessage(c)).toBe("No hemos podido guardar tu respuesta. Inténtalo de nuevo");
    }
  });
});

describe("textos", () => {
  it("pregunta de confirmación", () => {
    expect(confirmationQuestion("aprobada", "Pastillas de freno", "88,94 €")).toBe(
      "¿Apruebas «Pastillas de freno» por 88,94 €?",
    );
    expect(confirmationQuestion("rechazada", "Filtro", "30,86 €")).toBe("¿Rechazas «Filtro» por 30,86 €?");
  });
  it("resumen de la decisión con fecha y hora", () => {
    const s = decisionSummary("aprobada", "2030-01-05T09:30:00+00:00");
    expect(s).toMatch(/^Aprobado el /);
    expect(s).toMatch(/2030/);
    expect(s).toMatch(/10:30/);
    expect(decisionSummary("rechazada", "2030-01-05T09:30:00+00:00")).toMatch(/^Rechazado el /);
  });
});
