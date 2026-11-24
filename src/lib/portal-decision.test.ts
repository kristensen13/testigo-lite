import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideLineCore } from "./portal-decision";

const TOKEN = "ab".repeat(32);
const LINE = "11111111-1111-4111-8111-111111111111";
const GENERICO = "No hemos podido guardar tu respuesta. Inténtalo de nuevo";

/** Cliente falso: registra las llamadas rpc y responde con lo indicado. */
function fake(response: { data?: unknown; error?: { message: string } | null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: response.data ?? null, error: response.error ?? null });
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const valida = { token: TOKEN, lineId: LINE, decision: "aprobada" };

describe("decideLineCore", () => {
  it("entrada inválida no llega a la BD", async () => {
    for (const raw of [
      { ...valida, token: "corto" },
      { ...valida, lineId: "no-uuid" },
      { ...valida, decision: "pendiente" },
      { ...valida, importe: 100 },
      { ...valida, status: "listo" },
      null,
      undefined,
    ]) {
      const { client, calls } = fake({});
      expect(await decideLineCore(client, raw)).toEqual({ ok: false, error: GENERICO });
      expect(calls).toHaveLength(0);
    }
  });

  it("éxito: devuelve decisión y fecha, y solo envía token, línea y decisión", async () => {
    const { client, calls } = fake({
      data: { id: LINE, decision: "aprobada", decided_at: "2030-01-05T09:30:00+00:00" },
    });
    const r = await decideLineCore(client, valida);
    expect(r).toMatchObject({ ok: true, decision: "aprobada", decidedAt: "2030-01-05T09:30:00+00:00" });
    expect(r.ok && r.summary).toMatch(/^Aprobado el .*2030/);
    expect(calls).toEqual([
      { fn: "portal_decide", args: { p_token: TOKEN, p_line_id: LINE, p_decision: "aprobada" } },
    ]);
    expect(Object.keys(calls[0].args).sort()).toEqual(["p_decision", "p_line_id", "p_token"]);
  });

  it("traduce cada código de error de la RPC", async () => {
    const esperados: Record<string, RegExp | string> = {
      enlace_no_valido: "Este enlace ya no está disponible",
      orden_no_esperando_aprobacion: /todavía no espera tu respuesta/,
      linea_ya_decidida: "Este trabajo ya tiene una respuesta",
      linea_no_encontrada: /No encontramos/,
      decision_invalida: GENERICO,
      "FetchError: ECONNRESET 10.0.0.1": GENERICO,
    };
    for (const [codigo, esperado] of Object.entries(esperados)) {
      const { client } = fake({ error: { message: codigo } });
      const r = await decideLineCore(client, valida);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        if (typeof esperado === "string") expect(r.error).toBe(esperado);
        else expect(r.error).toMatch(esperado);
        expect(r.error).not.toContain("ECONNRESET");
        expect(r.error).not.toMatch(/_/); // nunca un código interno
      }
    }
  });

  it("respuesta inesperada de la RPC (otra línea o claves de más) se trata como error", async () => {
    for (const data of [
      null,
      { id: "22222222-2222-4222-8222-222222222222", decision: "aprobada", decided_at: "2030-01-05T09:30:00+00:00" },
      { id: LINE, decision: "aprobada", decided_at: "2030-01-05T09:30:00+00:00", extra: 1 },
      { id: LINE, decision: "pendiente", decided_at: "2030-01-05T09:30:00+00:00" },
    ]) {
      const { client } = fake({ data });
      expect(await decideLineCore(client, valida)).toEqual({ ok: false, error: GENERICO });
    }
  });
});
