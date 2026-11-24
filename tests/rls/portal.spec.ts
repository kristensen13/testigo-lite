import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  clienteAnon,
  clienteUsuario,
  crearOrden,
  matriculaUnica,
  WS1,
} from "./helpers";

// Requiere 0002_portal.sql aplicada. Cada test crea sus propias órdenes (matrícula
// E2E única) y no toca las del seed.

const TOKEN_HEX = /^[0-9a-f]{64}$/;
const ESTADOS = ["diagnostico", "esperando_aprobacion"] as const;

const CLAVES_RAIZ = ["expires_at", "lines", "status", "vehicle", "workshop"];
const CLAVES_LINEA = [
  "decided_at",
  "decision",
  "description",
  "id",
  "kind",
  "qty_milli",
  "unit_price_cents",
  "vat_bp",
];

interface OrdenPreparada {
  orderId: string;
  lineIds: string[];
  plate: string;
}

/** Crea una orden del taller 1 con dos líneas y la lleva al estado indicado. */
async function prepararOrden(
  estado: "recibido" | "esperando_aprobacion" = "esperando_aprobacion",
): Promise<OrdenPreparada> {
  const usuario = await clienteUsuario(1);
  const plate = matriculaUnica();
  const { data: orderId, error } = await crearOrden(usuario, { plate });
  expect(error, "create_order").toBeNull();

  const lineas = await usuario
    .from("order_lines")
    .insert([
      { order_id: orderId, workshop_id: WS1, kind: "recambio", description: "Pastillas E2E", qty_milli: 1000, unit_price_cents: 7350, position: 1 },
      { order_id: orderId, workshop_id: WS1, kind: "mano_de_obra", description: "Montaje E2E", qty_milli: 1500, unit_price_cents: 4500, position: 2 },
    ])
    .select("id, position");
  expect(lineas.error, "insert de líneas").toBeNull();
  const lineIds = (lineas.data ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.id as string);

  if (estado === "esperando_aprobacion") {
    for (const paso of ESTADOS) {
      const upd = await usuario.from("orders").update({ status: paso }).eq("id", orderId);
      expect(upd.error, `estado ${paso}`).toBeNull();
    }
  }
  return { orderId: orderId as string, lineIds, plate };
}

async function crearEnlace(usuario: SupabaseClient, orderId: string, ttl?: number): Promise<string> {
  const { data, error } = await usuario.rpc(
    "create_public_link",
    ttl === undefined ? { p_order_id: orderId } : { p_order_id: orderId, p_ttl_days: ttl },
  );
  expect(error, "create_public_link").toBeNull();
  expect(data).toMatch(TOKEN_HEX);
  return data as string;
}

function ordenadas(claves: string[]): string[] {
  return [...claves].sort();
}

/** Todas las claves de un valor JSON a cualquier profundidad (con su ruta). */
function todasLasClaves(valor: unknown, ruta = ""): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v) => todasLasClaves(v, `${ruta}[]`));
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([k, v]) => [`${ruta}.${k}`, ...todasLasClaves(v, `${ruta}.${k}`)]);
  }
  return [];
}

test.describe("Portal: portal_get", () => {
  test("un token aleatorio válido en formato no devuelve nada", async () => {
    const token = Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    const { data, error } = await clienteAnon().rpc("portal_get", { p_token: token });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  test("tokens con formato inválido no devuelven nada", async () => {
    for (const token of ["", "abc", "A".repeat(64), "z".repeat(64), "0".repeat(65)]) {
      const { data, error } = await clienteAnon().rpc("portal_get", { p_token: token });
      expect(error).toBeNull();
      expect(data).toBeNull();
    }
  });

  test("un token válido devuelve exactamente la lista blanca y ningún dato del cliente", async () => {
    const { orderId, lineIds, plate } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);

    const { data, error } = await clienteAnon().rpc("portal_get", { p_token: token });
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    expect(ordenadas(Object.keys(data))).toEqual(CLAVES_RAIZ);
    expect(ordenadas(Object.keys(data.workshop))).toEqual(["name", "phone"]);
    expect(ordenadas(Object.keys(data.vehicle))).toEqual(["make_model", "plate"]);
    expect(data.lines).toHaveLength(2);
    for (const linea of data.lines) {
      expect(ordenadas(Object.keys(linea))).toEqual(CLAVES_LINEA);
    }

    // Lista exacta de rutas a todos los niveles.
    expect(ordenadas(todasLasClaves(data))).toEqual(
      ordenadas([
        ".expires_at",
        ".lines",
        ".status",
        ".vehicle",
        ".vehicle.make_model",
        ".vehicle.plate",
        ".workshop",
        ".workshop.name",
        ".workshop.phone",
        ...data.lines.flatMap(() => CLAVES_LINEA.map((c) => `.lines[].${c}`)),
      ]),
    );

    expect(data.status).toBe("esperando_aprobacion");
    expect(data.vehicle.plate).toBe(plate);
    expect(data.lines.map((l: { id: string }) => l.id)).toEqual(lineIds); // por position
    expect(new Date(data.expires_at).getTime()).toBeGreaterThan(Date.now());

    // Nada del cliente ni del interior del taller.
    const texto = JSON.stringify(data);
    expect(texto).not.toContain("Cliente E2E RLS");
    expect(texto).not.toContain("600 000 999");
    expect(texto).not.toContain("Orden creada por el test de RLS.");
    expect(texto).not.toContain(orderId);
    expect(texto).not.toContain(WS1);
  });

  test("también se puede llamar con sesión de usuario", async () => {
    const { orderId } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);
    const { data, error } = await usuario.rpc("portal_get", { p_token: token });
    expect(error).toBeNull();
    expect(data?.status).toBe("esperando_aprobacion");
  });
});

test.describe("Portal: caducidad y revocación", () => {
  test("un enlace con p_ttl_days = 0 nace caducado: portal_get null y portal_decide falla", async () => {
    const { orderId, lineIds } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId, 0);
    const anon = clienteAnon();

    const get = await anon.rpc("portal_get", { p_token: token });
    expect(get.error).toBeNull();
    expect(get.data).toBeNull();

    const decide = await anon.rpc("portal_decide", {
      p_token: token,
      p_line_id: lineIds[0],
      p_decision: "aprobada",
    });
    expect(decide.error?.message).toBe("enlace_no_valido");
  });

  test("un enlace revocado con revoke_public_link no da acceso", async () => {
    const { orderId, lineIds } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);
    const anon = clienteAnon();

    expect((await anon.rpc("portal_get", { p_token: token })).data).not.toBeNull();

    const rev = await usuario.rpc("revoke_public_link", { p_order_id: orderId });
    expect(rev.error).toBeNull();

    const get = await anon.rpc("portal_get", { p_token: token });
    expect(get.error).toBeNull();
    expect(get.data).toBeNull();

    const decide = await anon.rpc("portal_decide", {
      p_token: token,
      p_line_id: lineIds[0],
      p_decision: "aprobada",
    });
    expect(decide.error?.message).toBe("enlace_no_valido");
  });

  test("crear un enlace nuevo revoca el anterior", async () => {
    const { orderId } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const viejo = await crearEnlace(usuario, orderId);
    const nuevo = await crearEnlace(usuario, orderId);
    expect(nuevo).not.toBe(viejo);

    const anon = clienteAnon();
    expect((await anon.rpc("portal_get", { p_token: viejo })).data).toBeNull();
    expect((await anon.rpc("portal_get", { p_token: nuevo })).data).not.toBeNull();

    const { data } = await usuario
      .from("public_links")
      .select("revoked_at")
      .eq("order_id", orderId);
    expect((data ?? []).filter((l) => l.revoked_at === null)).toHaveLength(1);
  });

  test("p_ttl_days fuera de 0..90 se rechaza", async () => {
    const { orderId } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    for (const ttl of [-1, 91, 1000]) {
      const { data, error } = await usuario.rpc("create_public_link", {
        p_order_id: orderId,
        p_ttl_days: ttl,
      });
      expect(error?.message, `ttl ${ttl}`).toBe("ttl_invalido");
      expect(data).toBeNull();
    }
    // Los extremos sí se admiten.
    await crearEnlace(usuario, orderId, 0);
    await crearEnlace(usuario, orderId, 90);
  });
});

test.describe("Portal: portal_decide", () => {
  test("decidir deja decision y decided_at y un evento de cliente visible para el taller", async () => {
    const { orderId, lineIds } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);

    const { data, error } = await clienteAnon().rpc("portal_decide", {
      p_token: token,
      p_line_id: lineIds[0],
      p_decision: "aprobada",
    });
    expect(error).toBeNull();
    expect(ordenadas(Object.keys(data))).toEqual(["decided_at", "decision", "id"]);
    expect(data.id).toBe(lineIds[0]);
    expect(data.decision).toBe("aprobada");
    expect(data.decided_at).not.toBeNull();

    const linea = await usuario
      .from("order_lines")
      .select("decision, decided_at")
      .eq("id", lineIds[0])
      .single();
    expect(linea.data?.decision).toBe("aprobada");
    expect(linea.data?.decided_at).not.toBeNull();

    const eventos = await usuario
      .from("order_events")
      .select("type, actor, line_id, note")
      .eq("order_id", orderId)
      .eq("type", "decision");
    expect(eventos.error).toBeNull();
    expect(eventos.data).toEqual([
      { type: "decision", actor: "cliente", line_id: lineIds[0], note: "aprobada" },
    ]);

    // La otra línea sigue pendiente y rechazar también funciona.
    const rechazo = await clienteAnon().rpc("portal_decide", {
      p_token: token,
      p_line_id: lineIds[1],
      p_decision: "rechazada",
    });
    expect(rechazo.error).toBeNull();
    expect(rechazo.data.decision).toBe("rechazada");
  });

  test("falla si la orden no está en esperando_aprobacion", async () => {
    const { orderId, lineIds } = await prepararOrden("recibido");
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);
    const { error } = await clienteAnon().rpc("portal_decide", {
      p_token: token,
      p_line_id: lineIds[0],
      p_decision: "aprobada",
    });
    expect(error?.message).toBe("orden_no_esperando_aprobacion");

    const linea = await usuario.from("order_lines").select("decision").eq("id", lineIds[0]).single();
    expect(linea.data?.decision).toBe("pendiente");
  });

  test("falla si la línea es de otra orden", async () => {
    const a = await prepararOrden();
    const b = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const tokenA = await crearEnlace(usuario, a.orderId);
    const { error } = await clienteAnon().rpc("portal_decide", {
      p_token: tokenA,
      p_line_id: b.lineIds[0],
      p_decision: "aprobada",
    });
    expect(error?.message).toBe("linea_no_encontrada");

    const linea = await usuario.from("order_lines").select("decision").eq("id", b.lineIds[0]).single();
    expect(linea.data?.decision).toBe("pendiente");
  });

  test("falla si la línea no existe", async () => {
    const { orderId } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);
    const { error } = await clienteAnon().rpc("portal_decide", {
      p_token: token,
      p_line_id: "00000000-0000-4000-8000-00000000dead",
      p_decision: "aprobada",
    });
    expect(error?.message).toBe("linea_no_encontrada");
  });

  test("no se puede decidir dos veces la misma línea", async () => {
    const { orderId, lineIds } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);
    const anon = clienteAnon();

    const primera = await anon.rpc("portal_decide", { p_token: token, p_line_id: lineIds[0], p_decision: "aprobada" });
    expect(primera.error).toBeNull();

    const segunda = await anon.rpc("portal_decide", { p_token: token, p_line_id: lineIds[0], p_decision: "rechazada" });
    expect(segunda.error?.message).toBe("linea_ya_decidida");

    const linea = await usuario.from("order_lines").select("decision").eq("id", lineIds[0]).single();
    expect(linea.data?.decision).toBe("aprobada");

    const eventos = await usuario
      .from("order_events")
      .select("id")
      .eq("order_id", orderId)
      .eq("type", "decision");
    expect(eventos.data).toHaveLength(1);
  });

  test("rechaza una decisión inválida y un token aleatorio", async () => {
    const { orderId, lineIds } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);
    const anon = clienteAnon();

    for (const decision of ["pendiente", "APROBADA", "", "x"]) {
      const { error } = await anon.rpc("portal_decide", { p_token: token, p_line_id: lineIds[0], p_decision: decision });
      expect(error?.message, decision).toBe("decision_invalida");
    }

    const falso = "a".repeat(64);
    const { error } = await anon.rpc("portal_decide", { p_token: falso, p_line_id: lineIds[0], p_decision: "aprobada" });
    expect(error?.message).toBe("enlace_no_valido");

    const linea = await usuario.from("order_lines").select("decision").eq("id", lineIds[0]).single();
    expect(linea.data?.decision).toBe("pendiente");
  });
});

test.describe("Portal: permisos", () => {
  test("el usuario del taller 2 no puede crear ni revocar enlaces de órdenes del taller 1", async () => {
    const { orderId } = await prepararOrden();
    const usuario1 = await clienteUsuario(1);
    const token = await crearEnlace(usuario1, orderId);
    const usuario2 = await clienteUsuario(2);

    const crear = await usuario2.rpc("create_public_link", { p_order_id: orderId });
    expect(crear.error?.message).toBe("orden no encontrada");
    expect(crear.data).toBeNull();

    const revocar = await usuario2.rpc("revoke_public_link", { p_order_id: orderId });
    expect(revocar.error?.message).toBe("orden no encontrada");

    // El enlace del taller 1 sigue vivo y el taller 2 no ve public_links ajenos.
    expect((await clienteAnon().rpc("portal_get", { p_token: token })).data).not.toBeNull();
    const visibles = await usuario2.from("public_links").select("id").eq("order_id", orderId);
    expect(visibles.data ?? []).toHaveLength(0);
  });

  test("una orden inexistente da el mismo error que una ajena", async () => {
    const usuario = await clienteUsuario(1);
    const { error } = await usuario.rpc("create_public_link", {
      p_order_id: "00000000-0000-4000-8000-00000000dead",
    });
    expect(error?.message).toBe("orden no encontrada");
  });

  test("el taller no puede insert, update ni delete directos en public_links, pero sí usar las funciones", async () => {
    const { orderId } = await prepararOrden();
    const usuario = await clienteUsuario(1);
    const token = await crearEnlace(usuario, orderId);

    const ins = await usuario.from("public_links").insert({
      order_id: orderId,
      workshop_id: WS1,
      token_hash: "a".repeat(64),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(ins.error?.code).toBe("42501");

    const upd = await usuario
      .from("public_links")
      .update({ revoked_at: null, expires_at: new Date(Date.now() + 999_999_999).toISOString() })
      .eq("order_id", orderId)
      .select("id");
    expect(upd.error?.code).toBe("42501");

    const del = await usuario.from("public_links").delete().eq("order_id", orderId).select("id");
    expect(del.error?.code).toBe("42501");

    // Conserva el select y el enlace sigue intacto y válido.
    const sel = await usuario.from("public_links").select("id, revoked_at").eq("order_id", orderId);
    expect(sel.error).toBeNull();
    expect(sel.data).toHaveLength(1);
    expect(sel.data?.[0].revoked_at).toBeNull();
    expect((await clienteAnon().rpc("portal_get", { p_token: token })).data).not.toBeNull();

    // Y las funciones sí funcionan.
    expect((await usuario.rpc("revoke_public_link", { p_order_id: orderId })).error).toBeNull();
  });

  test("anon no puede ejecutar create_public_link ni revoke_public_link ni leer public_links", async () => {
    const { orderId } = await prepararOrden();
    const anon = clienteAnon();

    const crear = await anon.rpc("create_public_link", { p_order_id: orderId });
    expect(crear.error).not.toBeNull();
    expect(crear.data).toBeNull();

    const revocar = await anon.rpc("revoke_public_link", { p_order_id: orderId });
    expect(revocar.error).not.toBeNull();

    const lectura = await anon.from("public_links").select("*");
    if (!lectura.error) expect(lectura.data ?? []).toHaveLength(0);
    else expect(lectura.error.code).toBe("42501");
  });
});
