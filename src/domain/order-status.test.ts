import { describe, expect, it } from "vitest";
import {
  CUSTOMER_LABELS,
  ORDER_STATUSES,
  canTransition,
  customerLabel,
  isOrderStatus,
  nextStatuses,
  workshopLabel,
} from "./order-status";

describe("estados", () => {
  it("lista ordenada de 6 igual que la BD", () => {
    expect([...ORDER_STATUSES]).toEqual([
      "recibido",
      "diagnostico",
      "esperando_aprobacion",
      "en_reparacion",
      "listo",
      "entregado",
    ]);
  });

  it("etiquetas del cliente", () => {
    expect(ORDER_STATUSES.map(customerLabel)).toEqual([
      "Recibido",
      "En diagnóstico",
      "Necesitamos tu OK",
      "En reparación",
      "Listo para recoger",
      "Entregado",
    ]);
    expect(Object.keys(CUSTOMER_LABELS)).toHaveLength(6);
  });

  it("etiquetas del taller para todos", () => {
    for (const s of ORDER_STATUSES) expect(workshopLabel(s).length).toBeGreaterThan(0);
  });

  it("isOrderStatus", () => {
    expect(isOrderStatus("listo")).toBe(true);
    expect(isOrderStatus("otro")).toBe(false);
    expect(isOrderStatus(3)).toBe(false);
  });
});

describe("canTransition: tabla completa 6x6", () => {
  ORDER_STATUSES.forEach((from, i) => {
    ORDER_STATUSES.forEach((to, j) => {
      const expected = from !== "entregado" && Math.abs(i - j) === 1;
      it(`${from} -> ${to}: ${expected ? "permitida" : "prohibida"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    });
  });

  it("entregado no admite ninguna", () => {
    expect(nextStatuses("entregado")).toEqual([]);
  });

  it("nextStatuses", () => {
    expect(nextStatuses("recibido")).toEqual(["diagnostico"]);
    expect(nextStatuses("en_reparacion")).toEqual(["esperando_aprobacion", "listo"]);
    expect(nextStatuses("listo")).toEqual(["en_reparacion", "entregado"]);
  });
});
