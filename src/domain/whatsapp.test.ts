import { describe, expect, it } from "vitest";
import { whatsappUrl } from "./whatsapp";

describe("whatsappUrl", () => {
  it.each([
    "600111222",
    "600 11 12 22",
    "600-111-222",
    "(600) 111 222",
    "+34 600 111 222",
    "0034600111222",
    "+34600111222",
  ])("%s -> prefijo 34", (phone) => {
    expect(whatsappUrl(phone, "Hola")).toEqual({
      ok: true,
      value: "https://wa.me/34600111222?text=Hola",
    });
  });

  it("codifica el texto", () => {
    const r = whatsappUrl("600111222", "Tu coche está listo & más: ¿ok? 100%");
    expect(r).toEqual({
      ok: true,
      value: `https://wa.me/34600111222?text=${encodeURIComponent("Tu coche está listo & más: ¿ok? 100%")}`,
    });
  });

  it("acepta otros países con prefijo", () => {
    expect(whatsappUrl("+351 912 345 678", "x")).toEqual({
      ok: true,
      value: "https://wa.me/351912345678?text=x",
    });
  });

  it.each(["", "   ", "abc", "12345", "60011122", "+34 60011122", "6001112223x", "+0034600111222"])(
    "teléfono inválido %j devuelve error tipado",
    (phone) => {
      const r = whatsappUrl(phone, "Hola");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(typeof r.error).toBe("string");
    },
  );
});
