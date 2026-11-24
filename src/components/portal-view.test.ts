import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalViewFromRpc } from "@/domain/portal";
import { PortalUnavailable, PortalView } from "./portal-view";

const TOKEN = "cd".repeat(32);

function html(lines: unknown[], status = "esperando_aprobacion"): string {
  const view = portalViewFromRpc({
    workshop: { name: "Taller Demo", phone: "910 000 000" },
    vehicle: { plate: "1234ABC", make_model: "Seat Ibiza" },
    status,
    expires_at: "2030-01-10T10:00:00+00:00",
    lines,
  });
  if (!view) throw new Error("vista no válida");
  return renderToStaticMarkup(createElement(PortalView, { view, token: TOKEN }));
}

const linea = (decision: string, decided_at: string | null) => ({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "recambio",
  description: "Pastillas",
  qty_milli: 1000,
  unit_price_cents: 7350,
  vat_bp: 2100,
  decision,
  decided_at,
});

describe("PortalView", () => {
  it("líneas decididas: texto de la decisión con su fecha y sin botones", () => {
    const out = html([
      linea("aprobada", "2030-01-05T09:30:00+00:00"),
      { ...linea("rechazada", "2030-01-06T10:00:00+00:00"), id: "22222222-2222-4222-8222-222222222222" },
      { ...linea("pendiente", null), id: "33333333-3333-4333-8333-333333333333" },
    ], "en_reparacion");
    expect(out).toContain("Aprobado");
    expect(out).toContain("Rechazado");
    expect(out).toContain("Pendiente");
    expect(out).toMatch(/Aprobado<\/span><span[^>]*> el [^<]*2030/);
    expect(out).not.toContain("<button");
    expect(out).not.toContain("11111111-1111");
  });
  it("esperando aprobación: botones solo en las líneas pendientes", () => {
    const out = html([
      linea("aprobada", "2030-01-05T09:30:00+00:00"),
      { ...linea("pendiente", null), id: "33333333-3333-4333-8333-333333333333" },
    ]);
    expect(out.match(/<button/g)).toHaveLength(2);
    expect(out).toContain("Aprobar");
    expect(out).toContain("Rechazar");
    expect(out).not.toContain("Sí, apruébalo"); // la confirmación no se pinta hasta pulsar
  });
  it("fuera de esperando aprobación no hay botones aunque haya pendientes", () => {
    for (const st of ["recibido", "diagnostico", "en_reparacion", "listo", "entregado"]) {
      expect(html([linea("pendiente", null)], st)).not.toContain("<button");
    }
  });
  it("estado vacío útil", () => {
    expect(html([])).toContain("Todavía no hay trabajos en el presupuesto");
  });
  it("teléfono como enlace tel: con nombre 'Llamar al taller' y pie discreto", () => {
    const out = html([]);
    expect(out).toContain('href="tel:910000000"');
    expect(out).toContain("Llamar al taller");
    expect(out).toContain("Testigo");
  });
  it("la página no disponible no da pistas", () => {
    const out = renderToStaticMarkup(createElement(PortalUnavailable));
    expect(out).toContain("Este enlace ya no está disponible");
    expect(out).toContain("Pide al taller que te envíe uno nuevo");
  });
});
