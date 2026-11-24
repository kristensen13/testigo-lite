-- =============================================================================
-- Testigo Lite - 0001_init.sql
-- Esquema base, RLS, privilegios, triggers y RPC create_order.
--
-- Se aplica a mano en el SQL Editor de Supabase (una sola vez). No se edita
-- una vez aplicada: los cambios van en una migración nueva.
--
-- Convenciones:
--   * Dinero siempre en céntimos (integer). Cantidad en milésimas (1,5 h = 1500).
--   * IVA en puntos básicos (2100 = 21 %).
--   * El acceso anónimo al portal llega en 0002 (funciones RPC security definer).
--     Ninguna tabla es legible por anon.
--   * Eventos del historial (order_events): type in ('creada','estado','decision',
--     'enlace_creado','enlace_revocado'). Para 'decision', actor = 'cliente',
--     line_id = línea decidida y note = decisión ('aprobada' | 'rechazada').
-- =============================================================================

begin;

-- El esquema por defecto de los objetos es "public".
set local search_path = public;

-- -----------------------------------------------------------------------------
-- Funciones auxiliares puras
-- -----------------------------------------------------------------------------

-- Misma regla que normalizePlate del dominio: mayúsculas, sin espacios ni guiones.
create function normalize_plate(p_plate text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_plate, ''), '[\s-]+', '', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table workshops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  phone       text not null check (char_length(phone) between 1 and 30),
  created_at  timestamptz not null default now()
);
alter table workshops enable row level security;

create table profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  workshop_id  uuid not null references workshops (id) on delete cascade,
  full_name    text not null default '' check (char_length(full_name) <= 120)
);
alter table profiles enable row level security;

create table customers (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null references workshops (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  phone        text not null check (char_length(phone) between 1 and 30),
  -- Permite claves foráneas compuestas que impiden mezclar talleres.
  constraint customers_id_workshop_key unique (id, workshop_id)
);
alter table customers enable row level security;

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null,
  customer_id  uuid not null,
  plate        text not null check (char_length(plate) between 1 and 20),
  plate_norm   text not null check (char_length(plate_norm) between 1 and 20),
  make_model   text not null check (char_length(make_model) between 1 and 120),
  km           integer not null check (km >= 0 and km <= 3000000),
  constraint vehicles_id_workshop_key unique (id, workshop_id),
  constraint vehicles_customer_fk foreign key (customer_id, workshop_id)
    references customers (id, workshop_id) on delete cascade
);
alter table vehicles enable row level security;

create table orders (
  id           uuid primary key default gen_random_uuid(),
  number       integer generated always as identity,
  workshop_id  uuid not null,
  customer_id  uuid not null,
  vehicle_id   uuid not null,
  status       text not null default 'recibido'
    check (status in ('recibido', 'diagnostico', 'esperando_aprobacion', 'en_reparacion', 'listo', 'entregado')),
  complaint    text not null check (char_length(complaint) between 1 and 2000),
  km_in        integer not null check (km_in >= 0 and km_in <= 3000000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint orders_id_workshop_key unique (id, workshop_id),
  constraint orders_workshop_fk foreign key (workshop_id)
    references workshops (id) on delete cascade,
  constraint orders_customer_fk foreign key (customer_id, workshop_id)
    references customers (id, workshop_id) on delete cascade,
  constraint orders_vehicle_fk foreign key (vehicle_id, workshop_id)
    references vehicles (id, workshop_id) on delete cascade
);
alter table orders enable row level security;

create table order_lines (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null,
  workshop_id       uuid not null,
  kind              text not null check (kind in ('mano_de_obra', 'recambio')),
  description       text not null check (char_length(description) between 1 and 200),
  qty_milli         integer not null check (qty_milli > 0 and qty_milli <= 1000000),
  unit_price_cents  integer not null check (unit_price_cents >= 0 and unit_price_cents <= 100000000),
  vat_bp            integer not null default 2100 check (vat_bp = 2100),
  decision          text not null default 'pendiente'
    check (decision in ('pendiente', 'aprobada', 'rechazada')),
  decided_at        timestamptz,
  "position"        integer not null default 0 check ("position" >= 0),
  -- Una línea está decidida si y solo si tiene fecha de decisión.
  constraint order_lines_decision_date_chk check ((decision = 'pendiente') = (decided_at is null)),
  constraint order_lines_order_fk foreign key (order_id, workshop_id)
    references orders (id, workshop_id) on delete cascade
);
alter table order_lines enable row level security;

create table order_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null,
  workshop_id  uuid not null,
  type         text not null
    check (type in ('creada', 'estado', 'decision', 'enlace_creado', 'enlace_revocado')),
  from_status  text check (from_status in ('recibido', 'diagnostico', 'esperando_aprobacion', 'en_reparacion', 'listo', 'entregado')),
  to_status    text check (to_status in ('recibido', 'diagnostico', 'esperando_aprobacion', 'en_reparacion', 'listo', 'entregado')),
  line_id      uuid references order_lines (id) on delete set null,
  actor        text not null default 'sistema' check (actor in ('taller', 'cliente', 'sistema')),
  note         text check (char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  constraint order_events_order_fk foreign key (order_id, workshop_id)
    references orders (id, workshop_id) on delete cascade
);
alter table order_events enable row level security;

-- Las funciones de enlaces llegan en 0002; la tabla se crea aquí para que el
-- esquema y la RLS queden completos. Solo se guarda el hash (SHA-256 en hex).
create table public_links (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null,
  workshop_id  uuid not null,
  token_hash   text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint public_links_expiry_chk check (expires_at > created_at),
  constraint public_links_order_fk foreign key (order_id, workshop_id)
    references orders (id, workshop_id) on delete cascade
);
alter table public_links enable row level security;

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------

create index orders_workshop_status_idx on orders (workshop_id, status);
create index orders_customer_idx on orders (customer_id);
create index orders_vehicle_idx on orders (vehicle_id);

-- Índice único (workshop_id, plate_norm): sirve de restricción y de índice de búsqueda.
create unique index vehicles_workshop_plate_norm_idx on vehicles (workshop_id, plate_norm);
alter table vehicles
  add constraint vehicles_workshop_plate_norm_key
  unique using index vehicles_workshop_plate_norm_idx;
create index vehicles_customer_idx on vehicles (customer_id);

create index customers_workshop_lower_name_idx on customers (workshop_id, lower(name));
create index order_lines_order_idx on order_lines (order_id);
create index order_events_order_created_idx on order_events (order_id, created_at);

-- Búsqueda por token: único.
create unique index public_links_token_hash_idx on public_links (token_hash);
alter table public_links
  add constraint public_links_token_hash_key
  unique using index public_links_token_hash_idx;
create index public_links_order_idx on public_links (order_id);

-- -----------------------------------------------------------------------------
-- Taller del usuario autenticado
-- -----------------------------------------------------------------------------

create function current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.workshop_id
  from public.profiles p
  where p.user_id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Privilegios de tabla
-- Supabase concede todo por defecto a anon y authenticated: se retira y se
-- concede solo lo necesario. RLS actúa además de estos privilegios.
-- -----------------------------------------------------------------------------

revoke all on workshops, profiles, customers, vehicles, orders, order_lines, order_events, public_links from anon;
revoke all on workshops, profiles, customers, vehicles, orders, public_links, order_events from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on workshops to authenticated;
grant select on profiles to authenticated;
grant select, insert, update on customers to authenticated;
grant select, insert, update on vehicles to authenticated;
grant select, insert, update on orders to authenticated;       -- sin delete, a propósito
grant select on order_events to authenticated;                  -- lo escribe el sistema
grant select, insert, update on public_links to authenticated;  -- sin delete

-- order_lines: privilegios por columna.
-- Supabase concede INSERT/UPDATE a nivel de tabla, y un revoke por columna
-- suelto no tendría efecto: se retira el privilegio de tabla y se concede por
-- columnas. decision y decided_at quedan fuera (solo las escribe el portal en
-- 0002 con una función security definer); vat_bp queda fijo en su valor por defecto.
revoke truncate, references, trigger on order_lines from authenticated;
revoke update on order_lines from authenticated;
grant update (kind, description, qty_milli, unit_price_cents, "position") on order_lines to authenticated;
revoke insert on order_lines from authenticated;
grant insert (order_id, workshop_id, kind, description, qty_milli, unit_price_cents, "position") on order_lines to authenticated;
grant select, delete on order_lines to authenticated;

-- -----------------------------------------------------------------------------
-- Políticas RLS (solo para usuarios autenticados; ninguna para anónimos)
-- -----------------------------------------------------------------------------

-- workshops: solo el propio taller.
create policy workshops_select on workshops
  for select to authenticated
  using (id = current_workshop_id());

-- profiles: solo la propia fila.
create policy profiles_select on profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- customers
create policy customers_select on customers
  for select to authenticated
  using (workshop_id = current_workshop_id());
create policy customers_insert on customers
  for insert to authenticated
  with check (workshop_id = current_workshop_id());
create policy customers_update on customers
  for update to authenticated
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- vehicles
create policy vehicles_select on vehicles
  for select to authenticated
  using (workshop_id = current_workshop_id());
create policy vehicles_insert on vehicles
  for insert to authenticated
  with check (workshop_id = current_workshop_id());
create policy vehicles_update on vehicles
  for update to authenticated
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- orders: sin política de delete, a propósito.
create policy orders_select on orders
  for select to authenticated
  using (workshop_id = current_workshop_id());
create policy orders_insert on orders
  for insert to authenticated
  with check (workshop_id = current_workshop_id() and status = 'recibido');
create policy orders_update on orders
  for update to authenticated
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- order_lines: update y delete solo mientras la línea está pendiente.
create policy order_lines_select on order_lines
  for select to authenticated
  using (workshop_id = current_workshop_id());
create policy order_lines_insert on order_lines
  for insert to authenticated
  with check (workshop_id = current_workshop_id() and decision = 'pendiente');
create policy order_lines_update on order_lines
  for update to authenticated
  using (workshop_id = current_workshop_id() and decision = 'pendiente')
  with check (workshop_id = current_workshop_id() and decision = 'pendiente');
create policy order_lines_delete on order_lines
  for delete to authenticated
  using (workshop_id = current_workshop_id() and decision = 'pendiente');

-- order_events: solo lectura para el taller (lo escriben triggers y funciones del sistema).
create policy order_events_select on order_events
  for select to authenticated
  using (workshop_id = current_workshop_id());

-- public_links (las funciones llegan en 0002).
create policy public_links_select on public_links
  for select to authenticated
  using (workshop_id = current_workshop_id());
create policy public_links_insert on public_links
  for insert to authenticated
  with check (workshop_id = current_workshop_id());
create policy public_links_update on public_links
  for update to authenticated
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- plate_norm siempre derivado de plate.
create function vehicles_set_plate_norm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.plate := btrim(new.plate);
  new.plate_norm := public.normalize_plate(new.plate);
  return new;
end;
$$;

create trigger vehicles_set_plate_norm
  before insert or update of plate on vehicles
  for each row execute function vehicles_set_plate_norm();

-- updated_at de orders.
create function orders_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Defensa en la BD: la orden no cambia de taller, cliente ni vehículo, y el
-- estado solo avanza o retrocede un paso (entregado es terminal).
create function orders_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_states constant text[] := array['recibido', 'diagnostico', 'esperando_aprobacion', 'en_reparacion', 'listo', 'entregado'];
  v_from integer;
  v_to integer;
begin
  if new.id is distinct from old.id
     or new.number is distinct from old.number
     or new.workshop_id is distinct from old.workshop_id
     or new.customer_id is distinct from old.customer_id
     or new.vehicle_id is distinct from old.vehicle_id then
    raise exception 'No se puede cambiar el taller, el cliente ni el vehículo de una orden'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    v_from := array_position(v_states, old.status);
    v_to := array_position(v_states, new.status);
    if old.status = 'entregado' or abs(v_to - v_from) <> 1 then
      raise exception 'Cambio de estado no permitido: % -> %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_guard
  before update on orders
  for each row execute function orders_guard();

create trigger orders_touch_updated_at
  before update on orders
  for each row execute function orders_touch_updated_at();

-- Historial: lo escribe el sistema (security definer), no los clientes.
create function orders_log_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, workshop_id, type, to_status, actor)
  values (
    new.id,
    new.workshop_id,
    'creada',
    new.status,
    case when (select auth.uid()) is null then 'sistema' else 'taller' end
  );
  return new;
end;
$$;

create function orders_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, workshop_id, type, from_status, to_status, actor)
  values (
    new.id,
    new.workshop_id,
    'estado',
    old.status,
    new.status,
    case when (select auth.uid()) is null then 'sistema' else 'taller' end
  );
  return new;
end;
$$;

create trigger orders_log_created
  after insert on orders
  for each row execute function orders_log_created();

create trigger orders_log_status_change
  after update of status on orders
  for each row
  when (old.status is distinct from new.status)
  execute function orders_log_status_change();

-- -----------------------------------------------------------------------------
-- RPC create_order (security invoker: se aplica la RLS del usuario)
-- Crea cliente, vehículo y orden en una sola transacción. Si la matrícula ya
-- existe en el taller, reutiliza vehículo y cliente y actualiza nombre,
-- teléfono, marca/modelo y km.
-- -----------------------------------------------------------------------------

create function create_order(
  p_customer_name  text,
  p_customer_phone text,
  p_plate          text,
  p_make_model     text,
  p_km             integer,
  p_complaint      text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workshop_id uuid := public.current_workshop_id();
  v_plate_norm  text := public.normalize_plate(p_plate);
  v_customer_id uuid;
  v_vehicle_id  uuid;
  v_order_id    uuid;
begin
  if v_workshop_id is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_plate_norm = '' then
    raise exception 'La matrícula es obligatoria' using errcode = '22023';
  end if;

  select v.id, v.customer_id
    into v_vehicle_id, v_customer_id
  from public.vehicles v
  where v.workshop_id = v_workshop_id
    and v.plate_norm = v_plate_norm;

  if v_vehicle_id is null then
    insert into public.customers (workshop_id, name, phone)
    values (v_workshop_id, btrim(p_customer_name), btrim(p_customer_phone))
    returning id into v_customer_id;

    insert into public.vehicles (workshop_id, customer_id, plate, make_model, km)
    values (v_workshop_id, v_customer_id, p_plate, btrim(p_make_model), p_km)
    returning id into v_vehicle_id;
  else
    update public.customers
       set name = btrim(p_customer_name),
           phone = btrim(p_customer_phone)
     where id = v_customer_id
       and workshop_id = v_workshop_id;

    update public.vehicles
       set make_model = btrim(p_make_model),
           km = p_km
     where id = v_vehicle_id
       and workshop_id = v_workshop_id;
  end if;

  insert into public.orders (workshop_id, customer_id, vehicle_id, complaint, km_in)
  values (v_workshop_id, v_customer_id, v_vehicle_id, btrim(p_complaint), p_km)
  returning id into v_order_id;

  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución de funciones (Supabase concede execute a anon por defecto)
-- -----------------------------------------------------------------------------

revoke all on function normalize_plate(text) from public, anon;
revoke all on function current_workshop_id() from public, anon;
revoke all on function create_order(text, text, text, text, integer, text) from public, anon;
revoke all on function vehicles_set_plate_norm() from public, anon, authenticated;
revoke all on function orders_touch_updated_at() from public, anon, authenticated;
revoke all on function orders_guard() from public, anon, authenticated;
revoke all on function orders_log_created() from public, anon, authenticated;
revoke all on function orders_log_status_change() from public, anon, authenticated;

grant execute on function normalize_plate(text) to authenticated;
grant execute on function current_workshop_id() to authenticated;
grant execute on function create_order(text, text, text, text, integer, text) to authenticated;

commit;
