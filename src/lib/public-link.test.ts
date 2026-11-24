import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createLink, ERR_SERVIDOR, fetchLinkInfo, revokeLink } from "./public-link";

const ORDER = "30000000-0000-4000-8000-000000000001";
const TOKEN = "ab".repeat(32);

function fake(rpcResult: { data: unknown; error: { message: string } | null }, rows: unknown[] = []) {
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const selects: string[] = [];
  const client = {
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
    from(table: string) {
      const b: Record<string, unknown> = {};
      b.select = (cols: string) => ((selects.push(`${table}:${cols}`), b));
      b.eq = () => b;
      b.order = () => b;
      b.limit = () => Promise.resolve({ data: rows, error: null });
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, rpcCalls, selects };
}

describe("createLink", () => {
  it("un id mal formado no llega a la BD", async () => {
    const f = fake({ data: TOKEN, error: null });
    for (const bad of ["x", "", undefined, null, 5]) {
      expect((await createLink(f.client, bad)).ok).toBe(false);
    }
    expect(f.rpcCalls).toHaveLength(0);
  });
  it("llama a la RPC con TTL de 7 días y devuelve el token", async () => {
    const f = fake({ data: TOKEN, error: null });
    expect(await createLink(f.client, ORDER)).toEqual({ ok: true, token: TOKEN });
    expect(f.rpcCalls).toEqual([
      { fn: "create_public_link", args: { p_order_id: ORDER, p_ttl_days: 7 } },
    ]);
  });
  it("traduce los errores de la RPC sin filtrar detalles", async () => {
    const a = await createLink(fake({ data: null, error: { message: "orden no encontrada" } }).client, ORDER);
    expect(a).toEqual({ ok: false, error: "No encontramos la orden." });
    const b = await createLink(
      fake({ data: null, error: { message: 'relation "public.public_links" violates ...' } }).client,
      ORDER,
    );
    expect(b).toEqual({ ok: false, error: ERR_SERVIDOR });
  });
  it("rechaza un token con forma inesperada", async () => {
    expect((await createLink(fake({ data: "corto", error: null }).client, ORDER)).ok).toBe(false);
  });
});

describe("revokeLink", () => {
  it("valida el id y llama a la RPC", async () => {
    const f = fake({ data: null, error: null });
    expect((await revokeLink(f.client, "no-uuid")).ok).toBe(false);
    expect(f.rpcCalls).toHaveLength(0);
    expect(await revokeLink(f.client, ORDER)).toEqual({ ok: true });
    expect(f.rpcCalls[0]).toEqual({ fn: "revoke_public_link", args: { p_order_id: ORDER } });
  });
  it("traduce errores", async () => {
    const r = await revokeLink(fake({ data: null, error: { message: "boom interno" } }).client, ORDER);
    expect(r).toEqual({ ok: false, error: ERR_SERVIDOR });
  });
});

describe("fetchLinkInfo", () => {
  it("pide solo expires_at y revoked_at, y nunca devuelve token_hash", async () => {
    const f = fake(
      { data: null, error: null },
      [{ expires_at: "2026-06-17T12:00:00Z", revoked_at: null, token_hash: "secreto" }],
    );
    const info = await fetchLinkInfo(f.client, ORDER);
    expect(f.selects).toEqual(["public_links:expires_at, revoked_at"]);
    expect(info).toEqual({ expiresAt: "2026-06-17T12:00:00Z", revokedAt: null });
    expect(JSON.stringify(info)).not.toContain("token_hash");
  });
  it("sin filas devuelve null", async () => {
    expect(await fetchLinkInfo(fake({ data: null, error: null }, []).client, ORDER)).toBeNull();
  });
});
