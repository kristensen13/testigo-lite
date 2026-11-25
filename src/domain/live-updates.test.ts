import { describe, expect, it } from "vitest";
import {
  MAX_NOTICES,
  dismissNotice,
  interpretChange,
  noticeText,
  pushNotice,
  type LiveNotice,
} from "./live-updates";

const nada = { refresh: false, notice: null };

describe("interpretChange: order_events", () => {
  it("una decisión refresca pero no avisa (no trae la descripción)", () => {
    expect(interpretChange("order_events", "INSERT", { type: "decision", note: "aprobada" })).toEqual({
      refresh: true,
      notice: null,
    });
  });

  it("enlace_creado y enlace_revocado nunca refrescan ni avisan", () => {
    for (const type of ["enlace_creado", "enlace_revocado"]) {
      expect(interpretChange("order_events", "INSERT", { type, note: "aprobada" })).toEqual(nada);
    }
  });

  it("cualquier otro tipo o evento se ignora", () => {
    expect(interpretChange("order_events", "INSERT", { type: "estado" })).toEqual(nada);
    expect(interpretChange("order_events", "INSERT", { type: "linea_añadida" })).toEqual(nada);
    expect(interpretChange("order_events", "UPDATE", { type: "decision" })).toEqual(nada);
    expect(interpretChange("order_events", "DELETE", { type: "decision" })).toEqual(nada);
  });
});

describe("interpretChange: order_lines", () => {
  const fila = (decision: string) => ({ id: "l1", description: "Filtro de aire", decision });

  it("aprobada y rechazada avisan y refrescan", () => {
    expect(interpretChange("order_lines", "UPDATE", fila("aprobada"))).toEqual({
      refresh: true,
      notice: { lineId: "l1", text: "El cliente ha aprobado «Filtro de aire»" },
    });
    expect(interpretChange("order_lines", "UPDATE", fila("rechazada")).notice?.text).toBe(
      "El cliente ha rechazado «Filtro de aire»",
    );
  });

  it("una edición del taller (pendiente) o un INSERT/DELETE se ignoran", () => {
    expect(interpretChange("order_lines", "UPDATE", fila("pendiente"))).toEqual(nada);
    expect(interpretChange("order_lines", "INSERT", fila("aprobada"))).toEqual(nada);
    expect(interpretChange("order_lines", "DELETE", fila("aprobada"))).toEqual(nada);
  });

  it("filas raras no rompen: se ignoran o solo refrescan", () => {
    expect(interpretChange("order_lines", "UPDATE", null)).toEqual(nada);
    expect(interpretChange("order_lines", "UPDATE", "x")).toEqual(nada);
    expect(interpretChange("order_lines", "UPDATE", { decision: "aprobada" })).toEqual({
      refresh: true,
      notice: null,
    });
  });

  it("otras tablas se ignoran", () => {
    expect(interpretChange("orders", "UPDATE", fila("aprobada"))).toEqual(nada);
  });
});

describe("noticeText", () => {
  it("solo incluye la decisión y el trabajo", () => {
    expect(noticeText("aprobada", "Cambio de pastillas")).toBe("El cliente ha aprobado «Cambio de pastillas»");
  });

  it("acorta descripciones largas y normaliza espacios", () => {
    const t = noticeText("rechazada", `  ${"a".repeat(200)}  `);
    expect(t.length).toBeLessThan(120);
    expect(t).toContain("…»");
    expect(noticeText("aprobada", "a \n  b")).toBe("El cliente ha aprobado «a b»");
  });
});

describe("avisos apilados", () => {
  const n = (id: string, lineId: string): LiveNotice => ({ id, lineId, text: id });

  it("el aviso de la misma línea sustituye al anterior", () => {
    const r = pushNotice([n("1", "a"), n("2", "b")], n("3", "a"));
    expect(r.map((x) => x.id)).toEqual(["2", "3"]);
  });

  it("conserva solo los más recientes", () => {
    let lista: LiveNotice[] = [];
    for (let i = 0; i < MAX_NOTICES + 2; i++) lista = pushNotice(lista, n(String(i), `l${i}`));
    expect(lista).toHaveLength(MAX_NOTICES);
    expect(lista[lista.length - 1].id).toBe(String(MAX_NOTICES + 1));
  });

  it("dismissNotice quita solo el indicado", () => {
    expect(dismissNotice([n("1", "a"), n("2", "b")], "1").map((x) => x.id)).toEqual(["2"]);
    expect(dismissNotice([n("1", "a")], "zzz")).toHaveLength(1);
  });
});
