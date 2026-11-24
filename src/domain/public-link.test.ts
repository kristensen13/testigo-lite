import { describe, expect, it } from "vitest";
import { whatsappUrl } from "./whatsapp";
import {
  buildPublicUrl,
  firstName,
  linkStatus,
  linkStatusText,
  parseOrigin,
  shareText,
} from "./public-link";

const NOW = new Date("2026-06-10T12:00:00Z");

describe("linkStatus", () => {
  it("sin enlace", () => {
    expect(linkStatus(null, NOW)).toEqual({ kind: "ninguno" });
    expect(linkStatusText({ kind: "ninguno" })).toBe("Sin enlace todavía");
  });
  it("activo con fecha", () => {
    const s = linkStatus({ expiresAt: "2026-06-17T12:00:00Z", revokedAt: null }, NOW);
    expect(s.kind).toBe("activo");
    expect(linkStatusText(s)).toMatch(/^Enlace activo hasta .*2026/);
  });
  it("caducado (también justo en el instante de caducidad)", () => {
    expect(linkStatus({ expiresAt: "2026-06-10T12:00:00Z", revokedAt: null }, NOW).kind).toBe("caducado");
    expect(linkStatusText({ kind: "caducado" })).toBe("Enlace caducado");
  });
  it("revocado gana sobre activo y caducado", () => {
    const r = "2026-06-09T00:00:00Z";
    expect(linkStatus({ expiresAt: "2026-06-17T12:00:00Z", revokedAt: r }, NOW).kind).toBe("revocado");
    expect(linkStatus({ expiresAt: "2026-06-01T12:00:00Z", revokedAt: r }, NOW).kind).toBe("revocado");
    expect(linkStatusText({ kind: "revocado" })).toBe("Enlace revocado");
  });
});

describe("parseOrigin", () => {
  it("usa x-forwarded-host y x-forwarded-proto", () => {
    expect(parseOrigin({ forwardedHost: "app.vercel.app", host: "x", forwardedProto: "https" })).toEqual({
      ok: true,
      value: "https://app.vercel.app",
    });
  });
  it("cae a host; localhost usa http por defecto, el resto https", () => {
    expect(parseOrigin({ host: "localhost:3100" })).toEqual({ ok: true, value: "http://localhost:3100" });
    expect(parseOrigin({ host: "taller.es" })).toEqual({ ok: true, value: "https://taller.es" });
  });
  it("toma el primer valor de listas y rechaza protocolos raros", () => {
    expect(parseOrigin({ forwardedHost: "a.es, b.es", forwardedProto: "javascript" })).toEqual({
      ok: true,
      value: "https://a.es",
    });
  });
  it("rechaza hosts con rutas, credenciales, espacios o vacíos", () => {
    for (const host of ["", "evil.com/x", "u:p@evil.com", "a b.com", "evil.com?x=1", "<script>"]) {
      expect(parseOrigin({ host }).ok).toBe(false);
    }
    expect(parseOrigin({}).ok).toBe(false);
  });
});

describe("buildPublicUrl y texto para compartir", () => {
  it("construye /p/<token>", () => {
    expect(buildPublicUrl("https://a.es/", "ab12")).toBe("https://a.es/p/ab12");
  });
  it("nombre de pila", () => {
    expect(firstName("  Ana  María López ")).toBe("Ana");
    expect(firstName("")).toBe("");
  });
  it("texto en castellano con la URL, enlazable con whatsappUrl", () => {
    const url = "https://a.es/p/ab12";
    const text = shareText("Ana López", "1234ABC", url);
    expect(text).toBe(
      "Hola Ana, aquí puedes ver el estado de tu coche (1234ABC) y aprobar el presupuesto: https://a.es/p/ab12",
    );
    expect(shareText("", "1234ABC", url)).toMatch(/^Hola, aquí/);
    const wa = whatsappUrl("600111222", text);
    expect(wa.ok && wa.value.startsWith("https://wa.me/34600111222?text=")).toBe(true);
    expect(wa.ok && decodeURIComponent(wa.value.split("?text=")[1])).toBe(text);
  });
});
