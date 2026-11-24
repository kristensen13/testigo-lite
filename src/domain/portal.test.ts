import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  parsePortalResponse,
  parsePortalToken,
  portalViewFromRpc,
  progressSteps,
  telHref,
} from "./portal";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";

function respuesta(over: Record<string, unknown> = {}) {
  return {
    workshop: { name: "Taller Demo", phone: "+34 910 000 000" },
    vehicle: { plate: "1234ABC", make_model: "Seat Ibiza" },
    status: "esperando_aprobacion",
    expires_at: "2030-01-10T10:00:00.123456+00:00",
    lines: [
      {
        id: L1,
        kind: "mano_de_obra",
        description: "Cambio de pastillas",
        qty_milli: 2000,
        unit_price_cents: 4000,
        vat_bp: 2100,
        decision: "pendiente",
        decided_at: null,
      },
      {
        id: L2,
        kind: "recambio",
        description: "Filtro de aire",
        qty_milli: 1000,
        unit_price_cents: 2550,
        vat_bp: 2100,
        decision: "aprobada",
        decided_at: "2030-01-05T09:30:00+00:00",
      },
    ],
    ...over,
  };
}

describe("parsePortalToken", () => {
  it("acepta 64 hex en minúscula", () => {
    expect(parsePortalToken("a".repeat(64)).ok).toBe(true);
  });
  it.each(["", "abc", "A".repeat(64), "g".repeat(64), "a".repeat(63), "a".repeat(65), " " + "a".repeat(64)])(
    "rechaza %j",
    (t) => {
      expect(parsePortalToken(t).ok).toBe(false);
    },
  );
  it("rechaza lo que no es texto", () => {
    expect(parsePortalToken(undefined).ok).toBe(false);
    expect(parsePortalToken(12).ok).toBe(false);
  });
});

describe("parsePortalResponse (lista blanca estricta)", () => {
  it("acepta la respuesta exacta", () => {
    expect(parsePortalResponse(respuesta()).ok).toBe(true);
  });
  it("null y basura no son respuesta", () => {
    expect(parsePortalResponse(null).ok).toBe(false);
    expect(parsePortalResponse("x").ok).toBe(false);
    expect(parsePortalResponse([]).ok).toBe(false);
  });
  it("una clave de más en la raíz la invalida", () => {
    expect(parsePortalResponse(respuesta({ customer_phone: "600" })).ok).toBe(false);
  });
  it("una clave de más en taller, vehículo o línea la invalida", () => {
    const base = respuesta();
    expect(parsePortalResponse({ ...base, workshop: { ...base.workshop, id: "x" } }).ok).toBe(false);
    expect(parsePortalResponse({ ...base, vehicle: { ...base.vehicle, km: 10 } }).ok).toBe(false);
    expect(
      parsePortalResponse({ ...base, lines: [{ ...base.lines[0], order_id: L2 }] }).ok,
    ).toBe(false);
  });
  it("un campo que falta la invalida", () => {
    const sinTaller: Record<string, unknown> = respuesta();
    delete sinTaller.workshop;
    expect(parsePortalResponse(sinTaller).ok).toBe(false);
    const base = respuesta();
    const sinFecha: Record<string, unknown> = { ...base.lines[0] };
    delete sinFecha.decided_at;
    expect(parsePortalResponse({ ...base, lines: [sinFecha] }).ok).toBe(false);
    const sinTel: Record<string, unknown> = { ...base.workshop };
    delete sinTel.phone;
    expect(parsePortalResponse({ ...base, workshop: sinTel }).ok).toBe(false);
  });
  it("estado, decisión o importes fuera de rango la invalidan", () => {
    const base = respuesta();
    expect(parsePortalResponse(respuesta({ status: "otro" })).ok).toBe(false);
    expect(parsePortalResponse({ ...base, lines: [{ ...base.lines[0], decision: "x" }] }).ok).toBe(false);
    expect(parsePortalResponse({ ...base, lines: [{ ...base.lines[0], unit_price_cents: 1.5 }] }).ok).toBe(false);
    expect(parsePortalResponse({ ...base, lines: [{ ...base.lines[0], qty_milli: 0 }] }).ok).toBe(false);
    expect(parsePortalResponse(respuesta({ expires_at: "mañana" })).ok).toBe(false);
  });
  it("portalViewFromRpc devuelve null si no encaja", () => {
    expect(portalViewFromRpc(null)).toBeNull();
    expect(portalViewFromRpc(respuesta({ extra: 1 }))).toBeNull();
  });
});

describe("progressSteps", () => {
  it("marca hecho, actual y pendiente con las etiquetas del cliente", () => {
    const steps = progressSteps("esperando_aprobacion");
    expect(steps.map((s) => s.label)).toEqual([
      "Recibido",
      "En diagnóstico",
      "Necesitamos tu OK",
      "En reparación",
      "Listo para recoger",
      "Entregado",
    ]);
    expect(steps.map((s) => s.state)).toEqual([
      "hecho",
      "hecho",
      "actual",
      "pendiente",
      "pendiente",
      "pendiente",
    ]);
  });
  it("en Recibido no hay pasos hechos y en Entregado todo es hecho salvo el último", () => {
    expect(progressSteps("recibido").filter((s) => s.state === "hecho")).toHaveLength(0);
    const fin = progressSteps("entregado");
    expect(fin.filter((s) => s.state === "hecho")).toHaveLength(5);
    expect(fin[5].state).toBe("actual");
  });
});

describe("formatQuantity y telHref", () => {
  it("formatea milésimas sin coma flotante", () => {
    expect(formatQuantity(1000)).toBe("1");
    expect(formatQuantity(1500)).toBe("1,5");
    expect(formatQuantity(250)).toBe("0,25");
    expect(formatQuantity(1001)).toBe("1,001");
    expect(formatQuantity(12000)).toBe("12");
  });
  it("limpia el teléfono para tel:", () => {
    expect(telHref("+34 910 000 000")).toBe("tel:+34910000000");
    expect(telHref("910-000-000")).toBe("tel:910000000");
    expect(telHref("sin dígitos")).toBeNull();
  });
});

describe("buildPortalView", () => {
  const view = portalViewFromRpc(respuesta())!;
  const norm = (s: string) => s.replace(/ /g, " ");

  it("estado del cliente y atención", () => {
    expect(view.statusLabel).toBe("Necesitamos tu OK");
    expect(view.needsAttention).toBe(true);
    expect(view.plate).toBe("1234ABC");
    expect(view.makeModel).toBe("Seat Ibiza");
  });
  it("importes de línea y totales (base 105,50 / IVA 22,16 / total 127,66)", () => {
    expect(view.lines.map((l) => norm(l.lineTotal))).toEqual(["80,00 €", "25,50 €"]);
    expect(norm(view.totals.base)).toBe("105,50 €");
    expect(norm(view.totals.vat)).toBe("22,16 €");
    expect(norm(view.totals.total)).toBe("127,66 €");
    // Solo la línea aprobada: 25,50 + 21 % = 30,86
    expect(norm(view.totals.approvedTotal)).toBe("30,86 €");
    expect(view.vatPercentText).toBe("21 %");
  });
  it("decisiones: pendiente sin fecha, aprobada con fecha", () => {
    expect(view.lines[0].decision).toEqual({ decision: "pendiente", label: "Pendiente", decidedAt: null });
    expect(view.lines[1].decision.label).toBe("Aprobado");
    expect(view.lines[1].decision.decidedAt).toMatch(/2030/);
    expect(view.lines[0].kindLabel).toBe("Mano de obra");
    expect(view.lines[1].kindLabel).toBe("Recambio");
  });
  it("estado vacío: sin líneas totales a cero", () => {
    const vacio = portalViewFromRpc(respuesta({ lines: [], status: "recibido" }));
    expect(vacio).not.toBeNull();
    expect(vacio!.lines).toHaveLength(0);
    expect(norm(vacio!.totals.total)).toBe("0,00 €");
    expect(vacio!.needsAttention).toBe(false);
  });
  it("teléfono y caducidad del taller", () => {
    expect(view.telHref).toBe("tel:+34910000000");
    expect(view.workshopName).toBe("Taller Demo");
    expect(view.expiresAt).toMatch(/2030/);
  });
});
