import { describe, expect, it } from "vitest";
import { parseNewOrder } from "./new-order";

const valido = {
  customerName: "  Ana Pérez ",
  customerPhone: "600 111 222",
  plate: "1234-abc",
  makeModel: "Seat Ibiza",
  km: "85000",
  complaint: "Ruido al frenar",
};

describe("parseNewOrder", () => {
  it("acepta datos válidos, recorta y convierte km a número", () => {
    const r = parseNewOrder(valido);
    expect(r).toEqual({
      ok: true,
      value: { ...valido, customerName: "Ana Pérez", km: 85000 },
    });
  });

  it("acepta teléfono internacional", () => {
    expect(parseNewOrder({ ...valido, customerPhone: "+44 7911 123456" }).ok).toBe(true);
  });

  it("marca cada campo vacío", () => {
    const r = parseNewOrder({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(
      ["complaint", "customerName", "customerPhone", "km", "makeModel", "plate"],
    );
  });

  it("rechaza teléfono inválido, km negativo/decimal/enorme y matrícula solo de separadores", () => {
    const campos = (o: object) => {
      const r = parseNewOrder({ ...valido, ...o });
      return r.ok ? [] : Object.keys(r.errors);
    };
    expect(campos({ customerPhone: "12345" })).toEqual(["customerPhone"]);
    expect(campos({ customerPhone: "abc" })).toEqual(["customerPhone"]);
    expect(campos({ km: "-5" })).toEqual(["km"]);
    expect(campos({ km: "1,5" })).toEqual(["km"]);
    expect(campos({ km: "3000001" })).toEqual(["km"]);
    expect(campos({ km: "3000000" })).toEqual([]);
    expect(campos({ km: "0" })).toEqual([]);
    expect(campos({ plate: " - - " })).toEqual(["plate"]);
  });

  it("aplica las longitudes máximas de la BD", () => {
    const campos = (o: object) => {
      const r = parseNewOrder({ ...valido, ...o });
      return r.ok ? [] : Object.keys(r.errors);
    };
    expect(campos({ customerName: "a".repeat(121) })).toEqual(["customerName"]);
    expect(campos({ customerName: "a".repeat(120) })).toEqual([]);
    expect(campos({ makeModel: "a".repeat(121) })).toEqual(["makeModel"]);
    expect(campos({ complaint: "a".repeat(2001) })).toEqual(["complaint"]);
    expect(campos({ plate: "A".repeat(21) })).toEqual(["plate"]);
    expect(campos({ plate: "AB-".repeat(7) })).toEqual(["plate"]);
  });

  it("ignora valores que no son texto", () => {
    expect(parseNewOrder({ ...valido, km: 5 }).ok).toBe(false);
  });
});
