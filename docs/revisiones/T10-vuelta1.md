# T10 - vuelta 1 (fase de preparación, revisión estática)

Resultado global: APROBADO como revisión estática. 0002_portal.sql NO está aplicada (por petición del usuario), así que los criterios 2-7 quedan **pendientes de ejecución tras aplicar la migración**. No se ejecutó ningún test rls ni el E2E; no se arrancó ningún servidor.

## Comandos ejecutados

- `npm run lint`: sin errores ni avisos.
- `npx tsc --noEmit`: sin errores (incluye tests/rls/portal.spec.ts).
- `npm test`: 14 ficheros, 187 tests en verde.
- `npm run build`: correcto.
- `git grep` de secretos y de `eyJ`: solo el hash de integrity de package-lock.json. `service_role`: solo en documentos y en el comentario de .env.example, nunca en 0002 ni en portal.spec.ts.
- `git ls-files | grep -i "^\.env" | grep -v "^\.env\.example$"`: vacío. No se leyó .env.local.
- `git status`/`git diff`: solo `PLAN.md` modificado (texto de T10) y dos ficheros nuevos. 0001_init.sql, seed.sql y el resto, intactos.

## Directrices

| Nº | Resultado | Evidencia |
|---|---|---|
| 1, 2, 3 | Cumple | lint, tsc y build sin errores |
| 4 | Cumple | sin any, ts-ignore ni eslint-disable en portal.spec.ts |
| 8 | Cumple | migración nueva; 0001 sin diff |
| 9, 11 | Cumple | `npm test` en verde; scripts presentes. No hay lógica de src/domain nueva |
| 10 | No aplica | la app no cambia; E2E no ejecutado por indicación |
| 12 | Cumple (por lectura) | ver tabla de criterios |
| 13 | Cumple | la migración no crea tablas; RLS de 0001 intacta; select de public_links por taller conservado |
| 14 | Cumple (estático) | create/revoke comprueban `current_workshop_id()` dentro de la función; test del taller 2 escrito |
| 15 | Cumple | `extensions.gen_random_bytes(32)` hex = 64 caracteres, 256 bits; solo se guarda el SHA-256 |
| 16 | Cumple | lista blanca de portal_get verificada línea a línea |
| 17 | Cumple (estático) | caducidad y revocación en portal_get y portal_decide; tests escritos |
| 18-21 | Cumple | greps limpios; solo .env.example versionado |
| 19 | Cumple | sin service_role |
| 34 | Cumple | índices de 0001: public_links(token_hash) único, public_links(order_id), order_lines(order_id) |

## Criterios de aceptación

| Criterio | Estado | Test que lo comprueba |
|---|---|---|
| 1. Revisión del SQL | Cumple | revisión de abajo |
| 2. Token aleatorio, lista blanca exacta, TTL 0, revocado | Pendiente de ejecución tras aplicar la migración | portal.spec.ts L89-L101, L104-L149 (claves exactas por nivel y por ruta, sin datos del cliente), L162-L201 |
| 3. decide: estado, línea ajena, ya decidida | Pendiente de ejecución | L283-L347 (también inexistente y decisión inválida) |
| 4. Enlace nuevo revoca el anterior | Pendiente de ejecución | L203-L219 |
| 5. Taller 2 no crea ni revoca | Pendiente de ejecución | L370-L395 |
| 6. Sin insert/update/delete directos; anon sin execute ni lectura | Pendiente de ejecución | L397-L445 |
| 7. TTL fuera de 0..90; 0 permitido | Pendiente de ejecución | L221-L235 y L162 |

Los tests podrían fallar de verdad: comparan listas exactas, comprueban el estado de la BD tras cada error y los mensajes estables.

## Revisión crítica del SQL

(a) Orden correcto (extensión, constraint, revoke/policies, función hash, create/revoke, portal_*, realtime, grants), todo entre begin/commit. Idempotente: `create or replace`, `drop ... if exists`, drop+add de la constraint, grants repetibles y DO que omite tablas ya publicadas. No toca 0001.

(b) Las cuatro funciones SECURITY DEFINER y el helper fijan `search_path = ''`. Todo está calificado: `public.*`, `extensions.digest`, `extensions.gen_random_bytes`; `current_workshop_id()` se llama como `public.current_workshop_id()`. No hay SQL dinámico salvo `format('%I')` sobre una lista fija en el bloque realtime. `portal_token_hash` no es ejecutable por anon ni authenticated. Los tipos de parámetro (uuid, integer) y la regex del token los validan.

(c) `revoke all ... from public, anon, authenticated` en las 5 funciones y grants exactos: create/revoke solo a authenticated; portal_get/portal_decide a anon y authenticated. `revoke insert, update, delete` sobre public_links a authenticated (queda select); anon sin privilegios (0001). No se concede nada de más.

(d) Pertenencia comprobada dentro de la función; mismo error `orden no encontrada` para orden inexistente, ajena, NULL o sin sesión; esa comprobación va antes que la de TTL, así que no hay fuga. TTL 0..90 con NULL rechazado. Token de 64 hex, solo se guarda el hash. Los enlaces activos anteriores se revocan.

(e) `expires_at >= created_at`. Con TTL 0, `created_at = now()` y `expires_at = now() + 0 days` usan el mismo `now()` de la transacción, así que son iguales y el check lo admite. Políticas public_links_insert/public_links_update eliminadas (nombres exactos de 0001); `public_links_select` se conserva.

(f) portal_get: token inválido, inexistente, caducado o revocado devuelven null (sin error). Una sola consulta. Devuelve solo workshop{name,phone}, vehicle{plate,make_model}, status, expires_at y lines[{id,kind,description,qty_milli,unit_price_cents,vat_bp,decision,decided_at}]. No hay nombre ni teléfono del cliente, km, avería, number, ids de orden/taller/cliente/vehículo, token_hash ni eventos. Cruce de talleres bloqueado por los joins con workshop_id.

(g) portal_decide: formato del token, luego enlace válido, luego decisión, luego orden `for share`, luego estado, luego línea de esa orden, luego `update ... where decision='pendiente' returning`. Si dos decisiones coinciden gana una y la otra recibe `linea_ya_decidida`. `for share` choca con el update de estado del taller, así que la orden no cambia a mitad de la decisión. El evento `decision`/`cliente`/`line_id`/`note=decisión` es coherente con los checks de 0001 y con el comentario de su cabecera. `decision`/`decided_at` cumplen order_lines_decision_date_chk.

(h) El bloque realtime: sin publicación solo hace `raise notice`; las tablas ya incluidas se omiten; usa `%I`. No falla al repetirse.

(i) Los eventos `enlace_creado` y `enlace_revocado` están permitidos por el check de 0001 y listados en su cabecera. src/domain/order-detail.ts (L75-L77) ya los pinta. No llevan datos (note nulo, actor `taller`). Observación, no fallo.

(j) portal.spec.ts: matrículas únicas con matriculaUnica(), sin tocar órdenes del seed, sin service_role y sin imprimir tokens ni credenciales. Tipa bien (tsc). Las aserciones sobre `error.message` se apoyan en el mensaje del campo message de PostgREST, que se conserva; están sin probar contra la BD. `select *` de public_links en aislamiento.spec.ts sigue válido (select conservado, tolera cero filas) y anon.spec.ts no se ve afectado.

(k) git: ver arriba.

## Observaciones (no son fallos)

1. Carrera en create_public_link: dos llamadas simultáneas para la misma orden podrían dejar dos enlaces activos, porque no se bloquea la orden. Se podría evitar con `select ... for update` de la orden. Riesgo bajo.
2. El test de TTL fuera de rango no prueba `p_ttl_days = null`, aunque el SQL lo rechaza.
3. `id` de línea y `vat_bp` en portal_get son necesarios para decidir y para los totales (no son ids de orden/taller/cliente).
4. portal.spec.ts crea unas 17 órdenes E2E por ejecución, que se suman a la acumulación ya anotada en PROGRESS.md (límite del tablero de 300 órdenes).
5. Los códigos SQLSTATE P0002/P0001/22023 y los mensajes de PostgREST no se pueden verificar hasta aplicar la migración.
