# Plan de tareas

Producto en `PRODUCT.md`. Normas de calidad en `DIRECTRICES.md`; los números entre paréntesis en cada tarea (por ejemplo "Directrices: 7, 13") remiten a esos puntos y son los que `testing` comprueba con más atención. Aun así, `testing` revisa todo lo aplicable de `DIRECTRICES.md`.

## Cómo se usa

- Las tareas se hacen **en orden** y de una en una (flujo de `CLAUDE.md`: develop → testing → corrección → cierre).
- Al cerrar una tarea, el orquestador marca su casilla `[x]`, actualiza `PROGRESS.md` y hace commit `feat(T<n>): …`.
- **Pausa del usuario:** algunas tareas necesitan que el usuario haga algo a mano (aplicar SQL en el SQL Editor de Supabase, crear usuarios, rellenar `.env.local`). El orquestador se detiene, lo pide y no lanza la tarea hasta que el usuario confirme.
- **Migraciones:** no hay Supabase CLI. Las migraciones (`0001_…`, `0002_…`, `0003_…`) y `seed.sql` se aplican a mano. Nunca se edita una migración ya aplicada: los cambios van en una migración nueva.
- **Next 16:** antes de usar cualquier API de Next, consulta `node_modules/next/dist/docs/`. El antiguo `middleware` ahora es `src/proxy.ts`.
- Nadie lee ni muestra `.env.local` ni ningún `.env*`. Playwright carga `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_EMAIL_2` y `E2E_PASSWORD_2` desde ese archivo.
- Las tareas que solo tocan la BD (T1, y el SQL de T10) se verifican con revisión del SQL; la prueba real contra la BD con la clave anónima llega en T3 (y en T10 tras aplicar la migración).

## Índice

- [x] T1 — Base de datos: `0001_init.sql` + `seed.sql`
- [x] T2 — Andamiaje: clientes Supabase, proxy, config de tests, diseño base
- [ ] T3 — Test de RLS con clave anon *(pausa del usuario: aplicar T1)*
- [ ] T4 — Dominio: importes, totales, estados, matrícula, WhatsApp
- [ ] T5 — Login, logout y rutas protegidas
- [ ] T6 — Tablero con buscador
- [ ] T7 — Nueva orden
- [ ] T8 — Ficha de la orden: datos, cambio de estado e historial
- [ ] T9 — Presupuesto: líneas y totales
- [ ] T10 — `0002_portal.sql`: enlaces y RPC del portal *(pausa del usuario: aplicar 0002)*
- [ ] T11 — Enlace para el cliente (UI del taller + WhatsApp)
- [ ] T12 — Portal del cliente (lectura)
- [ ] T13 — Portal: aprobar y rechazar con confirmación
- [ ] T14 — Aviso en vivo en tablero y ficha (Supabase Realtime)
- [ ] T15 — Pulido final: accesibilidad, flujo completo y despliegue

---

## T1 — Base de datos (`supabase/migrations/0001_init.sql`, `supabase/seed.sql`)

**Directrices:** 8, 13, 14, 16, 19, 34 (y 5 en los tipos de columna).

**Entrega**

- **Tablas:**
  - `workshops(id, name, phone, created_at)`
  - `profiles(user_id pk → auth.users, workshop_id, full_name)`
  - `customers(id, workshop_id, name, phone)`
  - `vehicles(id, workshop_id, customer_id, plate, plate_norm, make_model, km)`
  - `orders(id, number identity, workshop_id, customer_id, vehicle_id, status, complaint, km_in, created_at, updated_at)`
  - `order_lines(id, order_id, workshop_id, kind, description, qty_milli, unit_price_cents, vat_bp default 2100, decision default 'pendiente', decided_at, position)`
  - `order_events(id, order_id, workshop_id, type, from_status, to_status, line_id, actor, note, created_at)`
  - `public_links(id, order_id, workshop_id, token_hash unique, expires_at, revoked_at, created_at)` — se crea ya aquí para que RLS y esquema queden completos; sus funciones llegan en `0002`.
- **Restricciones:** `check` de estado (los 6 valores), `kind` (mano de obra | recambio), `decision`, `qty_milli > 0`, `unit_price_cents >= 0`, `km >= 0`, longitudes máximas, y `unique(workshop_id, plate_norm)` en vehículos. FKs con `on delete cascade` donde proceda.
- **Índices:** `orders(workshop_id, status)`, `vehicles(workshop_id, plate_norm)`, `customers(workshop_id, lower(name))`, `order_lines(order_id)`, `order_events(order_id, created_at)`, `public_links(token_hash)` único y `public_links(order_id)`.
- **RLS activado en todas las tablas** y función `current_workshop_id()` (`security definer`, `search_path=''`, lee `profiles` por `auth.uid()`).
  - Políticas explícitas de select/insert/update por `workshop_id = current_workshop_id()`.
  - `orders` sin política de delete, a propósito.
  - `order_lines`: update y delete solo si `decision = 'pendiente'`.
  - `order_events`: solo select (lo escribe el sistema).
  - `profiles`: select solo de la propia fila. `workshops`: select solo del propio taller.
  - Ninguna política para `anon`.
- **Privilegios de columna en `order_lines`.** Supabase concede UPDATE/INSERT a nivel de tabla por defecto, así que un `revoke update (decision, decided_at)` suelto no tendría efecto. Se hace así:
  - `revoke update on order_lines from authenticated;` y después `grant update (kind, description, qty_milli, unit_price_cents, position) on order_lines to authenticated;`
  - `revoke insert on order_lines from authenticated;` y después `grant insert (order_id, workshop_id, kind, description, qty_milli, unit_price_cents, position) on order_lines to authenticated;`
  - `decision` y `decided_at` quedan fuera de ambos `grant`; `vat_bp` queda fijo en su valor por defecto.
- **Triggers:** `updated_at` en `orders`, y un evento en `order_events` al crear la orden y al cambiar su `status` (funciones `security definer` con `search_path=''`).
- **RPC `create_order(...)`** (`security invoker`): recibe cliente, vehículo y avería; toma el taller de `current_workshop_id()`; crea cliente, vehículo y orden en una sola transacción. Si la matrícula ya existe en el taller, reutiliza vehículo y cliente (actualiza nombre, teléfono y km).
- **`seed.sql` re-ejecutable:**
  - Bloque inicial con los dos emails demo editables; enlaza cada usuario (de `auth.users`) a su taller por email y falla con un mensaje claro si el usuario no existe.
  - Borra y recrea los datos demo con ids fijos.
  - Taller 1: unas 10 órdenes repartidas por los 6 estados, con clientes, matrículas y teléfonos ficticios (`600 000 0xx`). Una en "Esperando aprobación" con 3 líneas pendientes (demo del portal), una con líneas ya decididas (para el chip del tablero) y una entregada.
  - Taller 2: 2 órdenes con matrículas propias (p. ej. `9999 ZZZ`) para el test de aislamiento.
  - Sin enlaces públicos en el seed.

**Criterios de aceptación**

1. Todo `create table` del esquema `public` va seguido de `enable row level security` y tiene al menos una política (comprobable con `git grep` sobre el SQL).
2. Ninguna política menciona `anon` ni `public`, y no aparece `service_role` en ningún archivo.
3. Ninguna columna de dinero es `numeric`, `float` ni `real`; todo es `integer`/`bigint`.
4. Existen los índices listados y la restricción `unique(workshop_id, plate_norm)`.
5. En `order_lines` hay `revoke update … from authenticated` y `revoke insert … from authenticated` a nivel de tabla, seguidos de `grant update (…)` y `grant insert (…)` con listas de columnas que **no** incluyen `decision` ni `decided_at` (un `revoke update (decision, decided_at)` suelto no cuenta). Las políticas de update/delete de `order_lines` exigen `decision = 'pendiente'`. La prueba real contra la BD es el criterio 5 de T3.
6. `order_events` no tiene políticas de insert, update ni delete para `authenticated`.
7. `seed.sql` crea 2 talleres, enlaza 2 usuarios por email y deja al menos una orden en cada uno de los 6 estados del taller 1.
8. Ningún secreto, contraseña ni email real en los archivos.
9. La revisión de `testing` es de lectura del SQL; la prueba contra la BD real es T3.

---

## T2 — Andamiaje

**Directrices:** 1–4, 11, 18–21, 31.

**Entrega**

- `src/lib/supabase/{server,browser}.ts` con `@supabase/ssr`, y variables validadas con zod en `src/lib/env.ts`.
- `src/proxy.ts`: refresca la sesión y redirige a `/login` lo que no es público. Públicos: `/login`, `/p/*` y los estáticos.
- `.env.example` sin valores.
- Configuración de Vitest y de Playwright (`webServer: npm run dev`, carga de `.env.local`) y los scripts `test` y `test:e2e` en `package.json`.
- Layout base con `lang="es"`, tokens de diseño en `globals.css` (según "Dirección visual" de `PRODUCT.md`), fuentes con `next/font`, utilidades para dar formato de euros y fechas en `es-ES`, y una página de inicio mínima.
- Cabeceras de `/p/*` en `next.config.ts`: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` y sin caché.
- Un test mínimo de Vitest y uno de Playwright para que ambos scripts pasen.

**Criterios de aceptación**

1. `npm test` y `npm run test:e2e` existen y pasan.
2. Un acceso sin sesión a `/` redirige a `/login` (test E2E).
3. `NEXT_PUBLIC_*` solo contiene la URL y la clave anónima de Supabase, y `git grep -ni service_role` no devuelve nada.
4. La respuesta de `/p/x` incluye `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` (test E2E).
5. `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan en verde.

---

## T3 — Test de RLS con clave anon

**Directrices:** 10, 12, 13, 14.

**Pausa del usuario.** Antes de lanzar la tarea, el usuario:

1. aplica `0001_init.sql` en el SQL Editor de Supabase,
2. crea los dos usuarios en Auth → Users,
3. rellena `.env.local` con la URL, la clave anónima y `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_EMAIL_2`, `E2E_PASSWORD_2`,
4. aplica `seed.sql`.

**Entrega:** `tests/rls/*.spec.ts` (proyecto `rls` de Playwright), con supabase-js y la clave anónima, sin `service_role`.

**Criterios de aceptación**

1. Anon: un `select` sobre cada tabla devuelve 0 filas o un error de permisos, y no puede insertar.
2. El usuario 1 ve solo filas del taller 1 en cada tabla, y ninguna de la matrícula `9999 ZZZ`.
3. El usuario 1 no puede insertar una orden con el `workshop_id` del taller 2.
4. El usuario 1 no puede actualizar órdenes del taller 2 (0 filas afectadas).
5. El usuario 1 no puede escribir `decision` ni `decided_at`: un `update` de esas columnas sobre una línea pendiente de su taller falla con `permission denied`, y un `insert` con `decision = 'aprobada'` también. Actualizar `description` o `qty_milli` de esa misma línea sí funciona (prueba de que el `grant` de columnas está bien montado y no se ha cerrado de más).
6. El usuario 1 no puede borrar una orden.
7. `create_order` crea cliente, vehículo y orden en el taller del usuario, y reutiliza el vehículo si la matrícula ya existe.
8. Los tests usan matrículas `E2E…` únicas.

---

## T4 — Dominio

**Directrices:** 5, 6, 9, 12.

**Entrega:** `src/domain/{money,totals,order-status,plate,whatsapp}.ts` con sus tests de Vitest. Sin imports de Next ni de Supabase.

- `parseEurosToCents("45,50") = 4550`; rechaza vacío, negativo, más de 2 decimales y texto. `formatCents(4550) = "45,50 €"`.
- `parseQuantityToMilli("1,5") = 1500`; máximo 2 decimales.
- `lineBaseCents` (half-up por línea) y `orderTotals(lines)`: base, IVA del 21 % sobre la suma de bases, total y, aparte, el total aprobado (solo líneas con `decision = 'aprobada'`).
- Estados: lista ordenada, etiqueta del taller, etiqueta del cliente, `canTransition(from, to)` (siguiente o anterior; `entregado` terminal) y `nextStatuses`.
- `normalizePlate("1234-bcd") = "1234BCD"` (mayúsculas, sin espacios ni guiones).
- `whatsappUrl(phone, text)`: los números españoles de 9 dígitos reciben el prefijo `34`; el texto va codificado con `encodeURIComponent`.

**Criterios de aceptación**

1. Casos con números concretos: 3 × 1,5 h × 45,50 € = 204,75 €, con IVA y total correctos, incluido un caso de redondeo en .5.
2. Una orden sin líneas da total 0 y total aprobado 0.
3. Tabla completa de transiciones permitidas y prohibidas, incluido que `entregado` no admite ninguna.
4. Ninguna operación usa coma flotante para el importe final: un test comprueba que 0,10 € + 0,20 € = 0,30 € trabajando en céntimos.
5. Las entradas inválidas devuelven un error tipado, no lanzan excepciones.

---

## T5 — Login, logout y rutas protegidas

**Directrices:** 7, 10, 22–25, 27, 29, 30.

**Entrega:** `/login` (email y contraseña, con `<label>` asociado y errores junto al campo), Server Action de login validada con zod, logout, layout autenticado con el nombre del taller, y `loading.tsx` y `error.tsx`.

**Criterios de aceptación** (E2E con el usuario demo)

1. Con credenciales correctas se llega al tablero; con las incorrectas se muestra "Email o contraseña incorrectos" sin perder el email escrito.
2. Un acceso sin sesión a cualquier ruta del taller redirige a `/login`.
3. Cerrar sesión devuelve a `/login`, y volver atrás con el navegador no muestra datos.
4. Un email mal formado muestra un error de validación junto al campo, en castellano.
5. El formulario es usable a 360 px y solo con teclado.

---

## T6 — Tablero con buscador

**Directrices:** 7, 25, 27–29, 31, 33, 34.

**Entrega:** pantalla principal del tablero, con una columna por estado (en móvil, lista agrupada por estado). Las tarjetas muestran matrícula, cliente, marca/modelo y antigüedad, y un chip "Cliente: x/y decididos" cuando hay decisiones. Buscador por matrícula o nombre de cliente mediante `searchParams`, validado con zod. Una sola consulta con selección de columnas. `loading.tsx`, `error.tsx` y estado vacío.

**Criterios de aceptación** (E2E con el seed)

1. Se ven órdenes en los 6 estados del taller 1 y ninguna del taller 2.
2. Buscar `1234abc`, `1234 ABC` y `1234-abc` encuentra la misma orden.
3. Buscar parte del nombre de un cliente filtra las tarjetas sin distinguir mayúsculas.
4. Una búsqueda sin resultados muestra un mensaje útil con una acción para limpiar el filtro.
5. Cada tarjeta enlaza a su ficha y se opera con teclado.
6. No hay consultas por orden (N+1): las líneas llegan en la misma consulta.

---

## T7 — Nueva orden

**Directrices:** 7, 22, 25, 29, 30.

**Entrega:** `/ordenes/nueva` con cliente (nombre, teléfono), vehículo (matrícula, marca/modelo, km) y avería. Server Action validada con zod que llama a `create_order`. Tras crear, redirige a la ficha. La orden nace en "Recibido".

**Criterios de aceptación** (E2E)

1. Con datos válidos crea la orden y aparece en la columna "Recibido" del tablero.
2. Cada campo vacío o inválido (teléfono, km negativo, matrícula vacía) muestra su error junto al campo y conserva lo escrito.
3. Con una matrícula que ya existe en el taller, reutiliza vehículo y cliente sin duplicarlos.
4. La matrícula se guarda normalizada para poder buscarla.
5. Todos los campos tienen label y el formulario funciona con teclado a 360 px.

---

## T8 — Ficha de la orden: datos, cambio de estado e historial

**Directrices:** 7, 14, 24, 27–29.

**Entrega:** `/ordenes/[id]` con los datos de cliente y vehículo, la avería, el cambio de estado (botones solo para las transiciones permitidas, mediante una Server Action que valida con el dominio) y el historial en orden cronológico inverso. Una orden de otro taller o inexistente da 404.

**Criterios de aceptación** (E2E)

1. Se ven los datos de la orden y un historial que incluye el evento de creación.
2. Solo se ofrecen las transiciones permitidas; forzar una no permitida desde la acción da error y no cambia nada.
3. Cambiar de estado actualiza la ficha y el tablero y añade un evento con fecha.
4. `Entregado` no ofrece más cambios.
5. Abrir la ficha de una orden del taller 2 con el usuario 1 da 404.

---

## T9 — Presupuesto: líneas y totales

**Directrices:** 5, 6, 7, 22, 30.

**Entrega:** sección de trabajos en la ficha. Alta, edición y borrado de líneas (tipo, descripción, cantidad, precio, IVA fijo del 21 %) con totales calculados por el dominio. Una línea con decisión no se edita ni se borra y se muestra bloqueada. Importes en céntimos.

**Criterios de aceptación** (E2E + Vitest)

1. Añadir mano de obra 2 h × 40,00 € y un recambio 1 × 25,50 € muestra base 105,50 €, IVA 22,16 € y total 127,66 €.
2. Los errores de cantidad o precio (cero, negativo, más de 2 decimales) salen junto al campo y no se pierde lo escrito.
3. Editar y borrar funcionan sobre líneas pendientes.
4. Una línea decidida se muestra bloqueada y no tiene botones; forzar el update desde la acción falla.
5. El servidor recalcula los importes; el cliente nunca envía totales.

---

## T10 — `0002_portal.sql`: enlaces y RPC del portal

**Directrices:** 8, 13, 15–17, 19, 34.

**Pausa del usuario.** Tras el commit de esta tarea, el usuario aplica `0002_portal.sql` en el SQL Editor. Los tests de esta tarea no se ejecutan hasta que lo confirme.

**Entrega**, en la migración `0002_portal.sql`:

- `create_public_link(p_order_id, p_ttl_days default 7)` (`security invoker`): comprueba que la orden es del taller, revoca el enlace activo anterior, genera el token con `encode(extensions.gen_random_bytes(32), 'hex')` (64 caracteres hexadecimales), guarda su SHA-256 y devuelve el token.
- `revoke_public_link(p_order_id)`.
- `portal_get(p_token)`: `security definer`, `search_path=''`, ejecutable por `anon`. Devuelve un `jsonb` con solo la lista blanca de campos de `PRODUCT.md`, o `null` si el token es inválido, está caducado o revocado.
- `portal_decide(p_token, p_line_id, p_decision)`: `security definer`. Exige enlace válido, orden en "Esperando aprobación", línea de esa orden y pendiente, y decisión en {aprobada, rechazada}. Escribe `decision`, `decided_at` y un evento con `actor = 'cliente'`. Devuelve el nuevo estado de la línea.
- `grant execute` solo a `anon` y `authenticated` para estas funciones y `revoke` del resto.
- Aviso en vivo: `alter publication supabase_realtime add table public.order_lines, public.order_events;`. Las políticas select por taller filtran lo que recibe cada usuario.

**Criterios de aceptación**

1. Revisión del SQL: no hay `service_role`; el token son 32 bytes de `gen_random_bytes` en hexadecimal (64 caracteres); solo se guarda el hash; las funciones `security definer` fijan `search_path`; y la publicación `supabase_realtime` incluye `order_lines` y `order_events`.
2. Test con anon, tras aplicar la migración:
   - un token aleatorio no devuelve nada;
   - un token válido devuelve **solo** las claves de la lista blanca (el test compara la lista exacta de claves);
   - con `expires_at` en el pasado (lo actualiza el usuario del taller), `portal_get` y `portal_decide` no dan acceso;
   - con `revoked_at` puesto, tampoco.
3. `portal_decide` falla si la orden no está en "Esperando aprobación", si la línea es de otra orden y si la línea ya está decidida (no se puede decidir dos veces).
4. Crear un enlace nuevo revoca el anterior.
5. El usuario del taller 2 no puede crear un enlace para una orden del taller 1.

---

## T11 — Enlace para el cliente (UI del taller)

**Directrices:** 7, 15, 17, 21, 24, 26, 29.

**Entrega:** botón "Enlace para el cliente" en la ficha. Una Server Action llama a `create_public_link`. Se muestra la URL `/p/<token>` (el origen sale de las cabeceras de la petición, sin variables `NEXT_PUBLIC_*` nuevas), un botón de copiar y un botón "Compartir por WhatsApp" con `wa.me` y un texto en castellano (usa `whatsappUrl` del dominio). Se indica el estado del enlace (activo hasta una fecha, caducado o revocado) y se puede revocar y generar uno nuevo. El token completo solo se ve justo después de crearlo.

**Criterios de aceptación** (E2E)

1. Al pulsar el botón aparece una URL `/p/<token>` donde el token cumple `^[0-9a-f]{64}$`, y un enlace `wa.me/34…` con el texto codificado.
2. Al recargar, la ficha muestra "Enlace activo hasta …" sin el token.
3. Revocar cambia el estado a "Revocado" y la URL anterior deja de funcionar.
4. Generar un enlace nuevo invalida el anterior.
5. Los botones tienen nombre accesible y funcionan con teclado.

---

## T12 — Portal del cliente (lectura)

**Directrices:** 16, 17, 23–27, 29, 32.

**Entrega:** `/p/[token]` (Server Component, sin login) que llama a `portal_get`. Panel con matrícula, marca/modelo y estado en lenguaje de cliente; tira de progreso; lista de trabajos con precios; totales (presupuesto y aprobado); y nombre y teléfono del taller. Una página genérica "Este enlace ya no está disponible" para token inválido, caducado o revocado. `loading.tsx` y `error.tsx`. Móvil primero.

**Criterios de aceptación** (E2E con un contexto de navegador sin sesión, viewport de 360 px)

1. Con un enlace válido se ven el estado (con el texto del cliente), el vehículo, los trabajos y los totales correctos.
2. El HTML no contiene el teléfono del cliente, el km ni el nombre completo del cliente.
3. Un token inválido, uno caducado y uno revocado dan exactamente la misma página y el mismo código de respuesta, sin pistas del motivo.
4. No hay scroll horizontal a 360 px, el texto base es ≥ 16 px y el contraste es AA.
5. Con la orden en otro estado se muestra el estado correspondiente y no hay botones de decisión.

---

## T13 — Portal: aprobar y rechazar con confirmación

**Directrices:** 7, 17, 22, 24, 26, 29, 30.

**Entrega:** en cada trabajo pendiente, con la orden en "Esperando aprobación", botones "Aprobar" y "Rechazar". Al pulsar se pide confirmación explícita con el nombre y el importe ("¿Apruebas «X» por N €?", o "¿Rechazas…?"). Server Action `decideLine` validada con zod que llama a `portal_decide`. Tras decidir se muestra la decisión con fecha y hora y desaparecen los botones; los totales se actualizan. El taller ve el resultado en el chip del tablero, en la ficha (decisión y fecha por línea) y en el historial.

**Criterios de aceptación** (E2E con dos contextos: cliente sin sesión y taller con sesión)

1. Aprobar el trabajo A y rechazar el B, cada uno con su confirmación; "Volver" cancela sin guardar.
2. Tras decidir se muestra "Aprobado/Rechazado el <fecha y hora>" y esa línea no conserva botones.
3. Al recargar, la decisión persiste y no se puede cambiar.
4. El total aprobado suma solo las líneas aprobadas.
5. El taller ve el chip "2/3" en el tablero, las decisiones con fecha en la ficha y los eventos del cliente en el historial.
6. Con la orden fuera de "Esperando aprobación" no hay botones de decisión.
7. Un error de red o de servidor muestra un mensaje en castellano dentro de la tarjeta, sin perder la confirmación.

---

## T14 — Aviso en vivo en tablero y ficha (Supabase Realtime)

**Directrices:** 21, 24, 26, 29, 31, 33.

**Depende de:** la publicación `supabase_realtime` de `0002_portal.sql` (T10, aplicada por el usuario).

**Entrega:** un componente cliente pequeño (`"use client"`, por ejemplo `src/components/LiveUpdates.tsx`) montado en el tablero y en la ficha.

- Se suscribe, con el cliente de navegador, a `postgres_changes` de `order_lines` y `order_events`, sin filtros propios (las políticas select por taller ya filtran lo que recibe cada usuario).
- Al llegar un cambio llama a `router.refresh()`, con un *debounce* corto para agrupar ráfagas.
- Muestra un aviso visible dentro de una región `aria-live="polite"`, con un texto como "El cliente ha aprobado «X»" o "El cliente ha rechazado «X»". Se puede cerrar y se apaga solo pasados unos segundos.
- Se desuscribe al desmontarse (`removeChannel`) y no deja canales duplicados.
- El aviso no incluye datos sensibles: solo el nombre del trabajo y la decisión. Si el canal falla, la app sigue funcionando sin avisos (sin error visible).

**Criterios de aceptación**

1. E2E con dos contextos: el taller (con sesión) tiene el tablero abierto y el cliente (sin sesión) aprueba un trabajo en `/p/<token>`. En menos de 5 s, sin recargar, el chip de la tarjeta pasa de "0/3" a "1/3" y aparece el aviso "El cliente ha aprobado «X»".
2. Lo mismo con la ficha abierta: la línea muestra la decisión y su fecha y el historial gana el evento, sin recargar y en menos de 5 s.
3. El aviso está en una región `aria-live`, su texto está en castellano y se puede cerrar con teclado.
4. Un usuario del taller 2 con el tablero abierto no recibe avisos ni cambios del taller 1 (test con dos sesiones).
5. Al salir de la pantalla se elimina el canal: no se acumulan canales al navegar entre tablero y ficha.
6. `NEXT_PUBLIC_*` sigue siendo solo la URL y la clave anónima, y `git grep -ni service_role` no devuelve nada.

---

## T15 — Pulido final: accesibilidad, flujo completo y despliegue

**Directrices:** todas (repaso global), con foco en 18–26.

**Entrega**

- Test E2E del flujo completo: login → nueva orden → presupuesto → "Esperando aprobación" → enlace → el cliente aprueba y rechaza → el taller lo ve al momento (aviso en vivo).
- Comprobación de accesibilidad con `@axe-core/playwright` (devDependency) en login, tablero, ficha y portal, esta última a 360 px.
- `README.md` con los pasos para aplicar migraciones y seed, crear los usuarios demo, rellenar `.env.local`, configurar las variables en Vercel y desplegar.
- Repaso de textos en castellano y de los estados vacíos, de carga y de error.

**Criterios de aceptación**

1. El flujo completo pasa en un solo test.
2. Axe no da violaciones `serious` ni `critical` en las 4 pantallas.
3. `git grep` de secretos y de `service_role`, y `git ls-files | grep -i "^\.env"`, no devuelven nada.
4. El README permite poner la app en marcha sin otro documento.
5. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` y `npm run test:e2e` terminan en verde.
