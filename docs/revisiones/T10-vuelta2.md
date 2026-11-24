# T10 - vuelta 2 (fase de preparación, revisión estática)

Resultado global: APROBADO como revisión estática. 0002_portal.sql sigue sin aplicar; los criterios 2-7 quedan pendientes de ejecución tras aplicar la migración. No se ejecutó ningún test rls ni E2E; no se arrancó ningún servidor.

## Comandos ejecutados
- npm run lint: sin errores. npx tsc --noEmit: sin errores. npm test: 187 tests en verde. npm run build: correcto.
- git grep de secretos y eyJ: sin coincidencias reales. service_role: solo documentos/comentarios, nunca en 0002 ni en portal.spec.ts. Solo .env.example versionado.
- git diff --stat sobre 0001_init.sql y seed.sql: vacío (intactos). Cambios desde el wip: solo 0002 y portal.spec.ts.

## Ajuste del índice único
- public_links_one_active_idx: una sola vez (create unique index if not exists ... (order_id) where revoked_at is null), tras la limpieza y antes de cualquier función.
- Limpieza: row_number() por order_id sobre revoked_at is null, orden created_at desc, id desc; revoca solo rn > 1 (deja la más reciente, no toca revocadas); sin duplicados no toca nada (idempotente). Va después del drop/add de la constraint de caducidad y de la retirada de permisos.
- Orden de la migración válido: extensión, constraint, permisos, limpieza, índice, funciones (create or replace), realtime, grants.

## Concurrencia (razonamiento)
- create_public_link hace select ... for update sobre orders (con workshop_id = taller del usuario) antes de revocar e insertar; mismo error P0002 'orden no encontrada' para sin usuario, id nulo, inexistente o ajena (comprobación de TTL después).
- READ COMMITTED: la 2ª llamada espera en el for update hasta que la 1ª hace commit. Una función plpgsql volátil toma instantánea nueva por sentencia, así que el update de revocación posterior ve y revoca el enlace commiteado por la 1ª. Serializa de verdad.
- TTL 0: el enlace nace caducado pero con revoked_at null; el update revoca TODOS los revoked_at null (también caducados) antes del insert, así que el índice nunca choca dentro de la función.
- Deadlock: create y revoke toman primero la fila de orders y luego solo escriben public_links/order_events (FK a orders: for key share, ya cubierto por el bloqueo propio). orders_guard/orders_log_* son triggers de update/insert y no se disparan con for update. Un cambio de estado toma la fila orders y luego inserta order_events: mismo orden. portal_decide toma for share en orders y luego order_lines; create/revoke no tocan order_lines. No hay ciclo de bloqueos.
- revoke_public_link: mismo bloqueo, misma comprobación y mismo error genérico.

## Seguridad de las funciones
Las cuatro funciones y el helper mantienen set search_path = '' y objetos calificados (public., extensions.). Grants/revokes intactos (create/revoke solo authenticated; portal_get/portal_decide anon y authenticated; helper sin acceso). begin/commit presentes, idempotente, sin service_role.

## Tests (portal.spec.ts)
- "dos creaciones seguidas": comprueba exactamente 2 filas, 1 activa, primer token portal_get null y segundo no null. Correcto.
- TTL 0 + TTL 0 + normal: 3 filas, 1 activa, último token funciona; no choca. Correcto.
- Concurrente (Promise.all): invariante 1 activa + exactamente 1 token funcional + filas = tokens devueltos; tipado correcto, sin imprimir tokens, matrícula única vía prepararOrden. No es flaky.
- Observación no bloqueante: acepta errores 'duplicate key'/'deadlock' y tokens.length >= 1, así que el test garantiza el invariante de la BD (índice) pero no detectaría que se pierda el bloqueo de la función (el segundo create fallaría con duplicate key en vez de funcionar). Opcional: exigir tokens.length === 2 una vez aplicada la migración.
- Tests previos (revoca el anterior, TTL 0/90, taller 2, permisos) siguen siendo válidos con el índice único.

## Directrices
1-3 cumple (lint/tsc/build). 4 cumple. 8 cumple (0001 intacta; 0002 editable por autorización expresa). 9, 11 cumple (npm test). 10 no aplica. 12 cumple (por lectura). 13-17 cumple (estático). 18-21 cumple. 34 cumple.
