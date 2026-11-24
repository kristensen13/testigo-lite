import { describe, expect, it } from "vitest";
import {
  buildHistory,
  isUuid,
  parseChangeStatus,
  statusButtons,
  type OrderEventRow,
} from "./order-detail";

const ID = "30000000-0000-4000-8000-000000000001";

describe("parseChangeStatus", () => {
  it("acepta uuid y estado válido", () => {
    expect(parseChangeStatus({ id: ID, to: "diagnostico" })).toEqual({
      ok: true,
      value: { id: ID, to: "diagnostico" },
    });
  });
  it("rechaza id mal formado, estado desconocido y entradas vacías", () => {
    expect(parseChangeStatus({ id: "abc", to: "listo" }).ok).toBe(false);
    expect(parseChangeStatus({ id: ID, to: "volando" }).ok).toBe(false);
    expect(parseChangeStatus({}).ok).toBe(false);
    expect(parseChangeStatus({ id: ID, to: 3 }).ok).toBe(false);
  });
});

describe("isUuid", () => {
  it("distingue uuids de otros textos", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("no-es-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("statusButtons", () => {
  it("desde Recibido solo ofrece Diagnóstico", () => {
    expect(statusButtons("recibido")).toEqual([{ to: "diagnostico", label: "Pasar a Diagnóstico" }]);
  });
  it("en el medio ofrece avanzar y retroceder", () => {
    expect(statusButtons("en_reparacion").map((b) => b.to)).toEqual(["esperando_aprobacion", "listo"]);
  });
  it("Entregado no ofrece nada", () => {
    expect(statusButtons("entregado")).toEqual([]);
  });
});

describe("buildHistory", () => {
  const ev = (over: Partial<OrderEventRow>): OrderEventRow => ({
    id: "e",
    type: "creada",
    from_status: null,
    to_status: "recibido",
    actor: "taller",
    note: null,
    created_at: "2026-03-10T09:30:00Z",
    ...over,
  });

  it("ordena del más reciente al más antiguo y formatea", () => {
    const h = buildHistory([
      ev({ id: "1" }),
      ev({ id: "2", type: "estado", from_status: "recibido", to_status: "diagnostico", created_at: "2026-03-10T11:00:00Z" }),
    ]);
    expect(h.map((x) => x.id)).toEqual(["2", "1"]);
    expect(h[0].title).toBe("Estado: Recibido → Diagnóstico");
    expect(h[1].title).toBe("Orden creada en Recibido");
    expect(h[1].actor).toBe("Taller");
    expect(h[1].when).toMatch(/2026/);
    expect(h[1].when).toMatch(/10:30/);
  });

  it("describe decisiones del cliente y actor desconocido", () => {
    const h = buildHistory([
      ev({ id: "d", type: "decision", actor: "cliente", note: "rechazada", to_status: null }),
      ev({ id: "x", actor: "otro", created_at: "2026-03-09T00:00:00Z" }),
    ]);
    expect(h[0].title).toBe("El cliente rechazó un trabajo");
    expect(h[0].actor).toBe("Cliente");
    expect(h[1].actor).toBe("Sistema");
  });

  it("lista vacía da historial vacío", () => {
    expect(buildHistory([])).toEqual([]);
  });
});
