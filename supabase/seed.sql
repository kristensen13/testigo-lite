-- =============================================================================
-- Testigo Lite - seed.sql (datos demo, re-ejecutable)
--
-- Antes de ejecutarlo:
--   1. Aplica 0001_init.sql en el SQL Editor de Supabase.
--   2. Crea los dos usuarios en Authentication > Users (con contraseña y
--      "Auto Confirm User" marcado).
--   3. Pon sus emails en las dos variables de abajo (v_email_1 y v_email_2).
--      Los valores de ejemplo son ficticios: cámbialos por los de tus usuarios.
--
-- Cada ejecución borra y recrea los dos talleres demo (con ids fijos) y todo lo
-- que cuelga de ellos, incluidas las órdenes creadas por los tests E2E, y deja
-- la base limpia. No crea enlaces públicos.
--
-- Se ejecuta como propietario (rol postgres del SQL Editor); no usa claves.
-- =============================================================================

do $seed$
declare
  -- ---- EDITA AQUÍ los emails de los usuarios creados en Auth > Users ----------
  v_email_1 constant text := 'demo@example.com';    -- usuario del taller 1
  v_email_2 constant text := 'demo2@example.com';   -- usuario del taller 2
  -- -----------------------------------------------------------------------------

  v_ws1     constant uuid := '00000000-0000-4000-8000-000000000001';
  v_ws2     constant uuid := '00000000-0000-4000-8000-000000000002';
  v_states  constant text[] := array['recibido', 'diagnostico', 'esperando_aprobacion', 'en_reparacion', 'listo', 'entregado'];
  v_user_1  uuid;
  v_user_2  uuid;
  r         record;
  i         integer;
begin
  -- 1. Usuarios: deben existir en auth.users --------------------------------------
  select u.id into v_user_1 from auth.users u where lower(u.email) = lower(v_email_1) limit 1;
  if v_user_1 is null then
    raise exception 'No existe en auth.users el usuario "%". Créalo en Authentication > Users o edita v_email_1 al principio de seed.sql y vuelve a ejecutarlo.', v_email_1;
  end if;

  select u.id into v_user_2 from auth.users u where lower(u.email) = lower(v_email_2) limit 1;
  if v_user_2 is null then
    raise exception 'No existe en auth.users el usuario "%". Créalo en Authentication > Users o edita v_email_2 al principio de seed.sql y vuelve a ejecutarlo.', v_email_2;
  end if;

  if v_user_1 = v_user_2 then
    raise exception 'v_email_1 y v_email_2 deben ser usuarios distintos.';
  end if;

  -- 2. Limpieza: borra los talleres demo y todo lo que cuelga de ellos -------------
  delete from public.profiles where user_id in (v_user_1, v_user_2);
  delete from public.workshops where id in (v_ws1, v_ws2);

  -- 3. Talleres y perfiles ------------------------------------------------------------
  insert into public.workshops (id, name, phone) values
    (v_ws1, 'Taller Demo Norte', '600 000 100'),
    (v_ws2, 'Taller Demo Sur',   '600 000 200');

  insert into public.profiles (user_id, workshop_id, full_name) values
    (v_user_1, v_ws1, 'Recepción Demo Norte'),
    (v_user_2, v_ws2, 'Recepción Demo Sur');

  -- 4. Órdenes demo (n 1..10 = taller 1, n 11..12 = taller 2) ------------------------
  drop table if exists pg_temp.seed_orders;
  create temp table seed_orders (
    n          integer primary key,
    cust_name  text,
    phone      text,
    plate      text,
    make_model text,
    km         integer,
    complaint  text,
    target     text,
    age_hours  integer
  );

  insert into seed_orders (n, cust_name, phone, plate, make_model, km, complaint, target, age_hours) values
    (1,  'Marta Gómez Ruiz',      '600 000 001', '1234 ABC', 'Seat León 1.6 TDI',        148200, 'Ruido al frenar y el pedal vibra.',                      'recibido',             3),
    (2,  'Luis Fernández Pardo',  '600 000 002', '5678 DFG', 'Renault Clio 2016',         96500, 'Se enciende el testigo del motor.',                      'recibido',             5),
    (3,  'Ana Belén Torres',      '600 000 003', '2468 HJK', 'Ford Focus 1.0 EcoBoost',   72300, 'Pierde líquido refrigerante.',                           'diagnostico',         30),
    (4,  'Carlos Medina Vega',    '600 000 004', '1357 LMN', 'Volkswagen Golf VII',      121000, 'Cambio de aceite y revisión de los 120.000 km.',         'diagnostico',         52),
    (5,  'Pilar Ortega Sanz',     '600 000 005', '4321 PQR', 'Toyota Yaris Hybrid',       58900, 'Hace ruido al frenar y la dirección vibra.',             'esperando_aprobacion', 75),
    (6,  'Javier Romero León',    '600 000 006', '8642 STV', 'Peugeot 208',               33400, 'Revisión antes de un viaje largo.',                      'esperando_aprobacion', 100),
    (7,  'Elena Navarro Gil',     '600 000 007', '9753 WXY', 'Citroën C3',                87600, 'No arranca por las mañanas.',                            'en_reparacion',      170),
    (8,  'Raúl Castro Díaz',      '600 000 008', '1122 BCD', 'Opel Corsa',               140800, 'El embrague patina al subir cuestas.',                   'en_reparacion',      200),
    (9,  'Sofía Vidal Marín',     '600 000 009', '3344 FGH', 'Dacia Sandero',             45200, 'Cambio de pastillas y discos delanteros.',               'listo',              250),
    (10, 'Iván Prieto Cano',      '600 000 010', '5566 JKL', 'Hyundai i30',              109400, 'El aire acondicionado no enfría.',                       'entregado',          400),
    (11, 'Teresa Ibáñez Roca',    '600 000 091', '9999 ZZZ', 'Kia Ceed',                  51000, 'Revisión general.',                                      'recibido',             6),
    (12, 'Hugo Sanz Alonso',      '600 000 092', '8888 YYY', 'Mazda 3',                   80200, 'Fallo de batería.',                                      'diagnostico',         28);

  -- Ids fijos: clientes 10..., vehículos 20..., órdenes 30..., líneas 40...
  insert into public.customers (id, workshop_id, name, phone)
  select ('10000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
         case when s.n <= 10 then v_ws1 else v_ws2 end,
         s.cust_name, s.phone
  from seed_orders s;

  insert into public.vehicles (id, workshop_id, customer_id, plate, make_model, km)
  select ('20000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
         case when s.n <= 10 then v_ws1 else v_ws2 end,
         ('10000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
         s.plate, s.make_model, s.km
  from seed_orders s;

  -- Las órdenes nacen en "recibido"; después se avanza paso a paso hasta su
  -- estado final para que el historial (triggers) quede coherente.
  insert into public.orders (id, workshop_id, customer_id, vehicle_id, complaint, km_in, created_at)
  select ('30000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
         case when s.n <= 10 then v_ws1 else v_ws2 end,
         ('10000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
         ('20000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
         s.complaint, s.km,
         now() - s.age_hours * interval '1 hour'
  from seed_orders s;

  for r in select s.n, array_position(v_states, s.target) as target_idx from seed_orders s order by s.n loop
    for i in 2..r.target_idx loop
      update public.orders
         set status = v_states[i]
       where id = ('30000000-0000-4000-8000-' || lpad(r.n::text, 12, '0'))::uuid;
    end loop;
  end loop;

  -- Fechas del historial: 6 h entre un paso y el siguiente a partir de la creación.
  update public.order_events e
     set created_at = o.created_at
                      + coalesce(array_position(v_states, e.to_status) - 1, 0) * interval '6 hours'
    from public.orders o
   where o.id = e.order_id
     and e.workshop_id in (v_ws1, v_ws2);

  -- 5. Líneas del presupuesto ------------------------------------------------------------
  -- (orden, posición, tipo, descripción, cantidad en milésimas, precio unitario en céntimos, decisión)
  insert into public.order_lines
    (id, order_id, workshop_id, kind, description, qty_milli, unit_price_cents, "position", decision, decided_at)
  select ('40000000-0000-4000-8000-' || lpad((l.n * 10 + l.pos)::text, 12, '0'))::uuid,
         o.id, o.workshop_id, l.kind, l.description, l.qty_milli, l.price_cents, l.pos, l.decision,
         case when l.decision = 'pendiente' then null else o.created_at + interval '15 hours' end
  from (values
    -- Taller 1, en diagnóstico (pendientes)
    (3,  1, 'mano_de_obra', 'Prueba de presión del circuito de refrigeración', 1000,  4500, 'pendiente'),
    (4,  1, 'recambio',     'Aceite 5W30 (5 litros)',                          1000,  4200, 'pendiente'),
    (4,  2, 'recambio',     'Filtro de aceite',                                1000,  1200, 'pendiente'),
    (4,  3, 'mano_de_obra', 'Cambio de aceite y filtro',                        500,  4500, 'pendiente'),
    -- Demo del portal: esperando aprobación con 3 líneas pendientes
    (5,  1, 'recambio',     'Pastillas de freno',                              1000,  7350, 'pendiente'),
    (5,  2, 'mano_de_obra', 'Sustitución de pastillas de freno',               1500,  4500, 'pendiente'),
    (5,  3, 'mano_de_obra', 'Revisión de la dirección y alineado',             1000,  3800, 'pendiente'),
    -- Esperando aprobación con 2 de 3 líneas ya decididas (chip 2/3 del tablero)
    (6,  1, 'mano_de_obra', 'Diagnosis con equipo',                             500,  4500, 'aprobada'),
    (6,  2, 'recambio',     'Filtro de aire',                                  1000,  1850, 'aprobada'),
    (6,  3, 'recambio',     'Escobillas limpiaparabrisas',                     1000,  2200, 'pendiente'),
    -- En reparación
    (7,  1, 'recambio',     'Batería 70 Ah',                                   1000,  9500, 'aprobada'),
    (7,  2, 'mano_de_obra', 'Montaje y prueba de carga',                        500,  4500, 'aprobada'),
    (7,  3, 'mano_de_obra', 'Limpieza de bornes y protector',                   250,  4500, 'rechazada'),
    (8,  1, 'recambio',     'Kit de embrague',                                 1000, 18900, 'aprobada'),
    (8,  2, 'mano_de_obra', 'Sustitución del embrague',                        3000,  4500, 'aprobada'),
    -- Listo y entregado
    (9,  1, 'recambio',     'Pastillas de freno delanteras',                   1000,  5400, 'aprobada'),
    (9,  2, 'recambio',     'Discos de freno delanteros (par)',                1000,  8900, 'aprobada'),
    (9,  3, 'mano_de_obra', 'Sustitución de pastillas y discos',               1500,  4500, 'aprobada'),
    (10, 1, 'recambio',     'Gas refrigerante R134a',                          1000,  3500, 'aprobada'),
    (10, 2, 'mano_de_obra', 'Carga y revisión del aire acondicionado',         1000,  4500, 'aprobada'),
    -- Taller 2
    (12, 1, 'mano_de_obra', 'Revisión de batería y alternador',                1000,  4000, 'pendiente')
  ) as l (n, pos, kind, description, qty_milli, price_cents, decision)
  join public.orders o
    on o.id = ('30000000-0000-4000-8000-' || lpad(l.n::text, 12, '0'))::uuid;

  -- Eventos de las decisiones ya tomadas (en producción los escribe portal_decide, en 0002).
  insert into public.order_events (order_id, workshop_id, type, line_id, actor, note, created_at)
  select l.order_id, l.workshop_id, 'decision', l.id, 'cliente', l.decision, l.decided_at
  from public.order_lines l
  where l.workshop_id in (v_ws1, v_ws2)
    and l.decision <> 'pendiente';

  drop table if exists pg_temp.seed_orders;

  raise notice 'Seed aplicado: 2 talleres, 2 usuarios enlazados (%, %), 12 órdenes demo.', v_email_1, v_email_2;
end
$seed$;
