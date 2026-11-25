import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { limitNotices, limitNoticeText } from "@/domain/board-limits";
import { LimitNotices, PreviousDeliveredLink } from "./board-notices";

describe("LimitNotices", () => {
  it("sin avisos no pinta nada", () => {
    expect(renderToStaticMarkup(createElement(LimitNotices, { notices: limitNotices({}) }))).toBe("");
  });

  it("con límite superado muestra el texto en castellano con role=status", () => {
    const out = renderToStaticMarkup(
      createElement(LimitNotices, { notices: limitNotices({ entregadas_recientes: true }) }),
    );
    expect(out).toContain('role="status"');
    expect(out).toContain(limitNoticeText("entregadas_recientes"));
    expect(out).not.toContain(limitNoticeText("abiertas"));
  });
});

describe("PreviousDeliveredLink", () => {
  it("no aparece si no hay entregadas anteriores", () => {
    expect(renderToStaticMarkup(createElement(PreviousDeliveredLink, { show: false, q: "" }))).toBe("");
  });

  it("aparece si existen y conserva q", () => {
    const out = renderToStaticMarkup(createElement(PreviousDeliveredLink, { show: true, q: "ana" }));
    expect(out).toContain("Ver entregadas anteriores");
    expect(out).toContain('href="/?entregadas=anteriores&amp;q=ana"');
  });
});
