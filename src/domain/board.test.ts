import { describe, expect, it } from "vitest";
import {
  ageLabel,
  buildSearchTerms,
  countDecisions,
  decisionChipLabel,
  escapeLike,
  groupByStatus,
  parseBoardSearch,
} from "./board";

describe("parseBoardSearch", () => {
  it("recorta y colapsa espacios", () => {
    expect(parseBoardSearch({ q: "  marta   gómez " })).toBe("marta gómez");
  });
  it("sin valor devuelve cadena vacía", () => {
    expect(parseBoardSearch({})).toBe("");
  });
  it("con valor repetido usa el primero", () => {
    expect(parseBoardSearch({ q: ["a", "b"] })).toBe("a");
  });
  it("un valor demasiado largo equivale a sin búsqueda", () => {
    expect(parseBoardSearch({ q: "x".repeat(81) })).toBe("");
  });
});

describe("escapeLike", () => {
  it("escapa \\, % y _", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
  it("no toca texto normal", () => {
    expect(escapeLike("Marta")).toBe("Marta");
  });
});

describe("buildSearchTerms", () => {
  it("sin texto no hay patrones", () => {
    expect(buildSearchTerms("   ")).toEqual({ namePattern: null, platePattern: null });
  });
  it("1234abc, 1234 ABC y 1234-abc dan el mismo patrón de matrícula", () => {
    const a = buildSearchTerms("1234abc").platePattern;
    expect(a).toBe("%1234ABC%");
    expect(buildSearchTerms("1234 ABC").platePattern).toBe(a);
    expect(buildSearchTerms("1234-abc").platePattern).toBe(a);
  });
  it("escapa comodines en ambos patrones", () => {
    const t = buildSearchTerms("a%_");
    expect(t.namePattern).toBe("%a\\%\\_%");
    expect(t.platePattern).toBe("%A\\%\\_%");
  });
  it("solo guiones: no hay patrón de matrícula pero sí de nombre", () => {
    const t = buildSearchTerms("-");
    expect(t.platePattern).toBeNull();
    expect(t.namePattern).toBe("%-%");
  });
});

describe("countDecisions y chip", () => {
  it("cuenta decididas sobre el total", () => {
    const c = countDecisions([
      { decision: "aprobada" },
      { decision: "rechazada" },
      { decision: "pendiente" },
    ]);
    expect(c).toEqual({ decided: 2, total: 3 });
    expect(decisionChipLabel(c)).toBe("Cliente: 2/3 decididos");
  });
  it("sin decididas no hay chip", () => {
    expect(decisionChipLabel(countDecisions([{ decision: "pendiente" }]))).toBeNull();
    expect(decisionChipLabel(countDecisions([]))).toBeNull();
  });
});

describe("ageLabel", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60_000;
  const H = 60 * MIN;
  it.each([
    [10_000, "ahora mismo"],
    [5 * MIN, "hace 5 min"],
    [3 * H, "hace 3 h"],
    [24 * H, "hace 1 día"],
    [52 * H, "hace 2 días"],
    [45 * 24 * H, "hace 1 mes"],
    [100 * 24 * H, "hace 3 meses"],
    [400 * 24 * H, "hace 1 año"],
    [800 * 24 * H, "hace 2 años"],
  ])("%d ms -> %s", (ms, out) => {
    expect(ageLabel(ago(ms), now)).toBe(out);
  });
  it("una fecha futura no da negativos", () => {
    expect(ageLabel(new Date(now.getTime() + H), now)).toBe("ahora mismo");
  });
});

describe("groupByStatus", () => {
  it("devuelve los 6 estados y conserva el orden", () => {
    const g = groupByStatus([
      { id: 1, status: "listo" as const },
      { id: 2, status: "recibido" as const },
      { id: 3, status: "listo" as const },
    ]);
    expect(Object.keys(g)).toEqual([
      "recibido",
      "diagnostico",
      "esperando_aprobacion",
      "en_reparacion",
      "listo",
      "entregado",
    ]);
    expect(g.listo.map((o) => o.id)).toEqual([1, 3]);
    expect(g.entregado).toEqual([]);
  });
});
