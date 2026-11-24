import { describe, expect, it } from "vitest";
import { parseLogin } from "./login";

describe("parseLogin", () => {
  it("acepta credenciales válidas y recorta el email", () => {
    const r = parseLogin({ email: "  a@b.es ", password: "x" });
    expect(r).toEqual({ ok: true, value: { email: "a@b.es", password: "x" } });
  });

  it("rechaza un email mal formado con mensaje en castellano", () => {
    const r = parseLogin({ email: "no-es-email", password: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toMatch(/email válido/);
      expect(r.errors.password).toBeUndefined();
    }
  });

  it("exige email y contraseña", () => {
    const r = parseLogin({ email: "", password: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBe("Escribe tu email");
      expect(r.errors.password).toBe("Escribe tu contraseña");
    }
  });

  it("tolera valores que no son texto", () => {
    expect(parseLogin({ email: null, password: 3 }).ok).toBe(false);
  });
});
