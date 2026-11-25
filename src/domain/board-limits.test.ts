import { describe, expect, it } from "vitest";
import {
  applyLimit,
  deliveredCutoff,
  fetchSize,
  ID_LIMIT,
  isRecentDelivery,
  limitNoticeText,
  limitNotices,
  OPEN_ORDERS_LIMIT,
  TOO_MANY_MATCHES_TEXT,
  parseBoardView,
  POSTGREST_DEFAULT_MAX_ROWS,
  PREVIOUS_DELIVERED_LIMIT,
  previousDeliveredHref,
  RECENT_DELIVERED_LIMIT,
} from "./board-limits";

const NOW = new Date("2026-06-30T12:00:00.000Z");

describe("límites", () => {
  it("tienen los valores del producto", () => {
    expect(OPEN_ORDERS_LIMIT).toBe(500);
    expect(RECENT_DELIVERED_LIMIT).toBe(300);
    expect(PREVIOUS_DELIVERED_LIMIT).toBe(200);
  });
});

describe("compatibilidad con el máximo de filas de PostgREST", () => {
  const limits = {
    OPEN_ORDERS_LIMIT,
    RECENT_DELIVERED_LIMIT,
    PREVIOUS_DELIVERED_LIMIT,
    ID_LIMIT,
  };

  it.each(Object.entries(limits))(
    "fetchSize(%s) es estrictamente menor que el max_rows por defecto",
    (name, limit) => {
      expect(
        fetchSize(limit),
        `${name} (${limit}) + 1 debe ser < ${POSTGREST_DEFAULT_MAX_ROWS} (Max rows de Supabase); si no, PostgREST recorta la fila extra y el aviso de límite nunca salta. Baja el límite.`,
      ).toBeLessThan(POSTGREST_DEFAULT_MAX_ROWS);
    },
  );
});

describe("fecha de corte de 30 días", () => {
  it("es now menos 30 días", () => {
    expect(deliveredCutoff(NOW).toISOString()).toBe("2026-05-31T12:00:00.000Z");
  });

  it("frontera: justo en el corte es reciente; un milisegundo antes, anterior", () => {
    const corte = deliveredCutoff(NOW).getTime();
    expect(isRecentDelivery(new Date(corte), NOW)).toBe(true);
    expect(isRecentDelivery(new Date(corte - 1), NOW)).toBe(false);
    expect(isRecentDelivery(new Date(corte + 1).toISOString(), NOW)).toBe(true);
  });

  it("usa el now inyectado", () => {
    const antes = new Date("2026-01-31T00:00:00.000Z");
    expect(deliveredCutoff(antes).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("applyLimit", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("pide límite + 1", () => {
    expect(fetchSize(300)).toBe(301);
  });

  it("con límite + 1 filas avisa y devuelve exactamente límite", () => {
    const r = applyLimit(rows(301), 300);
    expect(r.truncated).toBe(true);
    expect(r.rows).toHaveLength(300);
  });

  it("con límite o menos filas no avisa", () => {
    expect(applyLimit(rows(300), 300)).toMatchObject({ truncated: false });
    expect(applyLimit(rows(300), 300).rows).toHaveLength(300);
    expect(applyLimit(rows(0), 300)).toEqual({ rows: [], truncated: false });
  });
});

describe("textos de aviso", () => {
  it("indican qué se recorta y cómo seguir, en castellano", () => {
    expect(limitNoticeText("abiertas")).toBe(
      "Se muestran las 500 órdenes abiertas más recientes; hay más. Usa el buscador para encontrar una concreta.",
    );
    expect(limitNoticeText("entregadas_recientes")).toContain("300 órdenes entregadas");
    expect(limitNoticeText("entregadas_recientes")).toContain("30 días");
    expect(limitNoticeText("entregadas_anteriores")).toContain("200 entregadas anteriores");
  });

  it("limitNotices devuelve solo las listas recortadas", () => {
    expect(limitNotices({})).toEqual([]);
    expect(limitNotices({ abiertas: false, entregadas_recientes: false })).toEqual([]);
    expect(limitNotices({ entregadas_recientes: true })).toEqual([limitNoticeText("entregadas_recientes")]);
    expect(limitNotices({ entregadas_recientes: true, abiertas: true })).toEqual([
      limitNoticeText("abiertas"),
      limitNoticeText("entregadas_recientes"),
    ]);
  });
});

describe("aviso de demasiadas coincidencias", () => {
  it("ID_LIMIT es 200 y el texto exacto aparece en el aviso", () => {
    expect(ID_LIMIT).toBe(200);
    expect(TOO_MANY_MATCHES_TEXT).toBe("Hay demasiadas coincidencias, afina la búsqueda");
    const notices = limitNotices({ coincidencias: true });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("Hay demasiadas coincidencias, afina la búsqueda");
  });

  it("no avisa si no toca y sale una sola vez junto a los demás, al final", () => {
    expect(limitNotices({ coincidencias: false })).toEqual([]);
    const all = limitNotices({
      coincidencias: true,
      entregadas_anteriores: true,
      abiertas: true,
      entregadas_recientes: true,
    });
    expect(all).toHaveLength(4);
    expect(all.filter((n) => n.includes(TOO_MANY_MATCHES_TEXT))).toHaveLength(1);
    expect(all[3]).toContain(TOO_MANY_MATCHES_TEXT);
    expect(all[0]).toBe(limitNoticeText("abiertas"));
  });
});

describe("parseBoardView", () => {
  it("solo 'anteriores' activa la vista", () => {
    expect(parseBoardView({ entregadas: "anteriores" })).toBe("anteriores");
    expect(parseBoardView({ entregadas: ["anteriores", "x"] })).toBe("anteriores");
  });

  it("cualquier otro valor se ignora", () => {
    expect(parseBoardView({})).toBe("tablero");
    expect(parseBoardView({ entregadas: "" })).toBe("tablero");
    expect(parseBoardView({ entregadas: "todas" })).toBe("tablero");
    expect(parseBoardView({ entregadas: "ANTERIORES" })).toBe("tablero");
    expect(parseBoardView({ entregadas: ["x", "anteriores"] })).toBe("tablero");
  });
});

describe("previousDeliveredHref", () => {
  it("sin búsqueda", () => {
    expect(previousDeliveredHref("")).toBe("/?entregadas=anteriores");
  });

  it("conserva q codificada", () => {
    expect(previousDeliveredHref("ana & pérez")).toBe("/?entregadas=anteriores&q=ana+%26+p%C3%A9rez");
  });
});
