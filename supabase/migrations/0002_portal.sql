-- =============================================================================
-- Testigo Lite - 0002_portal.sql
-- Enlaces públicos del cliente y funciones RPC del portal.
--
-- Se aplica a mano en el SQL Editor de Supabase, de una sola vez (begin/commit:
-- si algo falla no queda nada a medias). No se edita una vez aplicada: los
-- cambios van en una migración nueva. Está escrita para poder re-ejecutarse
-- sin error (create or replace, drop ... if exists, grants idempotentes).
--
-- Resumen:
--   1. Caducidad: public_links_expiry_chk pasa a "expires_at >= created_at"
--      (un TTL de 0 días crea un enlace que nace ya caducado; permite probarlo).
--   2. public_links solo se escribe por funciones security definer: se retiran
--      insert/update/delete a authenticated y las políticas de insert/update.
--   3. create_public_link / revoke_public_link (solo authenticated).
--   4. portal_get / portal_decide (anon y authenticated), con lista blanca.
--   5. Aviso en vivo: order_lines y order_events en la publicación realtime.
--
-- Token: 32 bytes aleatorios (extensions.gen_random_bytes) en hexadecimal, 64
-- caracteres en minúscula. En la BD solo se guarda su SHA-256 en hexadecimal
-- (misma representación que public_links.token_hash, ^[0-9a-f]{64}$).
-- El hash se calcula SIEMPRE con public.portal_token_hash(), para que
-- create_public_link, portal_get y portal_decide coincidan.
--
-- Errores estables de las funciones (mensaje exacto en el campo message):
--   orden no encontrada             orden ajena o inexistente (sin distinguir)
--   ttl_invalido                    p_ttl_days fuera de 0..90
--   enlace_no_valido                token inexistente, caducado o revocado
--   decision_invalida               p_decision distinta de aprobada/rechazada
--   orden_no_esperando_aprobacion   la orden no está en "esperando_aprobacion"
--   linea_no_encontrada             la línea no existe o no es de la orden del enlace
--   linea_ya_decidida               la línea ya no estaba pendiente
-- =============================================================================

begin;

-- pgcrypto: en Supabase ya está en el esquema "extensions"; esto es inocuo si existe.
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Caducidad relajada
-- -----------------------------------------------------------------------------

alter table public.public_links
  drop constraint if exists public_links_expiry_chk;
alter table public.public_links
  add constraint public_links_expiry_chk check (expires_at >= created_at);

-- -----------------------------------------------------------------------------
-- 2. public_links: escritura solo mediante funciones security definer
--    authenticated conserva select (RLS public_links_select por taller).
--    anon no tiene ningún privilegio sobre la tabla (ya revocado en 0001).
-- -----------------------------------------------------------------------------

revoke insert, update, delete on public.public_links from authenticated;
drop policy if exists public_links_insert on public.public_links;
drop policy if exists public_links_update on public.public_links;

-- -----------------------------------------------------------------------------
-- Hash del token (interno: solo lo llaman las funciones security definer)
-- -----------------------------------------------------------------------------

create or replace function public.portal_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- 3. Funciones del taller (solo authenticated)
-- -----------------------------------------------------------------------------

-- Crea un enlace nuevo para la orden y devuelve el token en claro (única vez que
-- existe fuera de la BD). Revoca antes el enlace anterior de esa orden.
create or replace function public.create_public_link(p_order_id uuid, p_ttl_days integer default 7)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workshop_id uuid := public.current_workshop_id();
  v_token       text;
  v_revoked     integer;
begin
  -- Mismo error si no hay usuario, la orden no existe o es de otro taller.
  if v_workshop_id is null
     or p_order_id is null
     or not exists (
       select 1 from public.orders o
       where o.id = p_order_id and o.workshop_id = v_workshop_id
     ) then
    raise exception 'orden no encontrada' using errcode = 'P0002';
  end if;

  if p_ttl_days is null or p_ttl_days < 0 or p_ttl_days > 90 then
    raise exception 'ttl_invalido' using errcode = '22023';
  end if;

  update public.public_links l
     set revoked_at = now()
   where l.order_id = p_order_id
     and l.workshop_id = v_workshop_id
     and l.revoked_at is null;
  get diagnostics v_revoked = row_count;

  if v_revoked > 0 then
    insert into public.order_events (order_id, workshop_id, type, actor)
    values (p_order_id, v_workshop_id, 'enlace_revocado', 'taller');
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.public_links (order_id, workshop_id, token_hash, created_at, expires_at)
  values (
    p_order_id,
    v_workshop_id,
    public.portal_token_hash(v_token),
    now(),
    now() + make_interval(days => p_ttl_days)
  );

  insert into public.order_events (order_id, workshop_id, type, actor)
  values (p_order_id, v_workshop_id, 'enlace_creado', 'taller');

  return v_token;
end;
$$;

-- Revoca el enlace activo de la orden (si lo hay).
create or replace function public.revoke_public_link(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workshop_id uuid := public.current_workshop_id();
  v_revoked     integer;
begin
  if v_workshop_id is null
     or p_order_id is null
     or not exists (
       select 1 from public.orders o
       where o.id = p_order_id and o.workshop_id = v_workshop_id
     ) then
    raise exception 'orden no encontrada' using errcode = 'P0002';
  end if;

  update public.public_links l
     set revoked_at = now()
   where l.order_id = p_order_id
     and l.workshop_id = v_workshop_id
     and l.revoked_at is null;
  get diagnostics v_revoked = row_count;

  if v_revoked > 0 then
    insert into public.order_events (order_id, workshop_id, type, actor)
    values (p_order_id, v_workshop_id, 'enlace_revocado', 'taller');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Portal del cliente (anon y authenticated)
-- -----------------------------------------------------------------------------

-- portal_get(p_token) devuelve jsonb con SOLO esta lista blanca, o NULL si el
-- token es inválido, inexistente, caducado o revocado (casos indistinguibles):
--
--   {
--     "workshop":   { "name", "phone" },
--     "vehicle":    { "plate", "make_model" },
--     "status":     text,                       -- estado de la orden
--     "expires_at": timestamptz (ISO 8601),
--     "lines": [                                -- ordenadas por position
--       { "id", "kind", "description", "qty_milli", "unit_price_cents",
--         "vat_bp", "decision", "decided_at" }
--     ]
--   }
--
-- Nunca se devuelve: nombre ni teléfono del cliente, km, avería, notas,
-- historial, number, ids de orden/taller/cliente/vehículo ni token_hash.
create or replace function public.portal_get(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select jsonb_build_object(
           'workshop', jsonb_build_object('name', w.name, 'phone', w.phone),
           'vehicle',  jsonb_build_object('plate', v.plate, 'make_model', v.make_model),
           'status',   o.status,
           'expires_at', l.expires_at,
           'lines', coalesce(
             (select jsonb_agg(
                       jsonb_build_object(
                         'id', ln.id,
                         'kind', ln.kind,
                         'description', ln.description,
                         'qty_milli', ln.qty_milli,
                         'unit_price_cents', ln.unit_price_cents,
                         'vat_bp', ln.vat_bp,
                         'decision', ln.decision,
                         'decided_at', ln.decided_at
                       )
                       order by ln."position", ln.id
                     )
                from public.order_lines ln
               where ln.order_id = o.id),
             '[]'::jsonb
           )
         )
    into v_result
    from public.public_links l
    join public.orders o    on o.id = l.order_id and o.workshop_id = l.workshop_id
    join public.workshops w on w.id = o.workshop_id
    join public.vehicles v  on v.id = o.vehicle_id and v.workshop_id = o.workshop_id
   where l.token_hash = public.portal_token_hash(p_token)
     and l.revoked_at is null
     and l.expires_at > now();

  return v_result;  -- null si no hay fila
end;
$$;

-- Decide una línea pendiente de la orden del enlace. Devuelve
-- { "id", "decision", "decided_at" } de la línea. El evento del historial usa
-- type 'decision', actor 'cliente', line_id = la línea y note = la decisión.
create or replace function public.portal_decide(p_token text, p_line_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id     uuid;
  v_workshop_id  uuid;
  v_status       text;
  v_line_id      uuid;
  v_decision     text;
  v_decided_at   timestamptz;
begin
  -- Enlace válido (mismo criterio que portal_get). Error genérico en cualquier fallo.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'enlace_no_valido' using errcode = 'P0001';
  end if;

  select l.order_id, l.workshop_id
    into v_order_id, v_workshop_id
    from public.public_links l
   where l.token_hash = public.portal_token_hash(p_token)
     and l.revoked_at is null
     and l.expires_at > now();

  if v_order_id is null then
    raise exception 'enlace_no_valido' using errcode = 'P0001';
  end if;

  if p_decision is null or p_decision not in ('aprobada', 'rechazada') then
    raise exception 'decision_invalida' using errcode = '22023';
  end if;

  -- Bloquea la orden contra cambios de estado concurrentes mientras se decide.
  select o.status
    into v_status
    from public.orders o
   where o.id = v_order_id and o.workshop_id = v_workshop_id
     for share;

  if v_status is distinct from 'esperando_aprobacion' then
    raise exception 'orden_no_esperando_aprobacion' using errcode = 'P0001';
  end if;

  if p_line_id is null or not exists (
       select 1 from public.order_lines ln
       where ln.id = p_line_id and ln.order_id = v_order_id
     ) then
    raise exception 'linea_no_encontrada' using errcode = 'P0001';
  end if;

  -- Atómico: solo cambia si sigue pendiente (dos decisiones simultáneas: gana una).
  update public.order_lines ln
     set decision = p_decision,
         decided_at = now()
   where ln.id = p_line_id
     and ln.order_id = v_order_id
     and ln.decision = 'pendiente'
  returning ln.id, ln.decision, ln.decided_at
    into v_line_id, v_decision, v_decided_at;

  if v_line_id is null then
    raise exception 'linea_ya_decidida' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, workshop_id, type, line_id, actor, note)
  values (v_order_id, v_workshop_id, 'decision', v_line_id, 'cliente', v_decision);

  return jsonb_build_object('id', v_line_id, 'decision', v_decision, 'decided_at', v_decided_at);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Aviso en vivo: order_lines y order_events en la publicación realtime
--    Supabase trae la publicación creada; si no existe solo se avisa.
--    Si una tabla ya está publicada, se omite (no falla al re-ejecutar).
-- -----------------------------------------------------------------------------

do $realtime$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'La publicación supabase_realtime no existe: order_lines y order_events NO se han añadido. Créala (o actívala en Database > Replication) y añade las tablas.';
    return;
  end if;

  foreach v_table in array array['order_lines', 'order_events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$realtime$;

-- -----------------------------------------------------------------------------
-- 6. Permisos de ejecución (Supabase concede execute a anon por defecto)
-- -----------------------------------------------------------------------------

revoke all on function public.portal_token_hash(text) from public, anon, authenticated;
revoke all on function public.create_public_link(uuid, integer) from public, anon, authenticated;
revoke all on function public.revoke_public_link(uuid) from public, anon, authenticated;
revoke all on function public.portal_get(text) from public, anon, authenticated;
revoke all on function public.portal_decide(text, uuid, text) from public, anon, authenticated;

grant execute on function public.create_public_link(uuid, integer) to authenticated;
grant execute on function public.revoke_public_link(uuid) to authenticated;
grant execute on function public.portal_get(text) to anon, authenticated;
grant execute on function public.portal_decide(text, uuid, text) to anon, authenticated;

commit;
