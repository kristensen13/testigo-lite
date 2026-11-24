# Progreso

| Tarea | Estado | Vueltas de revisión | Notas |
|---|---|---|---|
| T1 — Base de datos | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T1-vuelta1.md`. El SQL solo se ha revisado por lectura; la prueba real contra la BD es T3. |
| T2 — Andamiaje | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T2-vuelta1.md`. `.env.example` creado pero **sin versionar** (conflicto con la directriz 20, pendiente de decisión del usuario). Playwright usa el puerto 3100. |
| T3 — Test de RLS con clave anon | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T3-vuelta1.md`. 34 tests de RLS en verde contra la BD real: `0001_init.sql` no ha necesitado cambios. Script `npm run test:rls`. |
| T4 — Dominio | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T4-vuelta1.md`. 106 tests de Vitest. Tipo `Result` para errores de entrada. |
| T5 — Login y rutas protegidas | Hecha | 2 | Vuelta 1: FALLO (directriz 10, el setup E2E agotaba el timeout de 5 s con el servidor en frío). Vuelta 2: APROBADA. Informes: `docs/revisiones/T5-vuelta1.md` y `T5-vuelta2.md`. Logout como `POST /logout` (route handler). El tablero de `/` es provisional hasta T6. |
| T6 — Tablero con buscador | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T6-vuelta1.md`. 136 tests de Vitest y 17 E2E. Sin N+1: 1 consulta sin búsqueda, 3 con búsqueda. |
| T7 — Nueva orden | Hecha | 2 | Vuelta 1: FALLO (directriz 10: el test de T6 "criterio 5" recorría Tab con tope fijo y dejó de alcanzar la tarjeta al acumularse órdenes E2E). Vuelta 2: APROBADA. Informes: `docs/revisiones/T7-vuelta1.md` y `T7-vuelta2.md`. 142 tests de Vitest y 20 E2E. |
| T8 — Ficha de la orden | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T8-vuelta1.md`. 157 tests de Vitest, 27 E2E y el spec de BD `tests/rls/cambio-estado.spec.ts`. La ficha deja un hueco (`data-slot="presupuesto-y-enlace"`) para T9 y T11. |
| T9 — Presupuesto | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T9-vuelta1.md`. 187 tests de Vitest, 33 E2E y el spec de BD `tests/rls/lineas-decididas.spec.ts`. El precio 0 se rechaza (el criterio 2 lista "cero"); la BD lo permitiría. |
| T10 — `0002_portal.sql` | Preparada, sin aplicar | 2 (revisiones estáticas) | `0002_portal.sql` y `tests/rls/portal.spec.ts` escritos y revisados por lectura (`docs/revisiones/T10-vuelta1.md` y `T10-vuelta2.md`: APROBADO estático). La vuelta 2 añade el índice único parcial `public_links_one_active_idx` (un enlace activo por orden garantizado por la BD, con limpieza previa de duplicados) y el bloqueo `for update` de la orden en `create_public_link` y `revoke_public_link`. **Pausa del usuario: aplicar `0002_portal.sql` en el SQL Editor.** Después hay que ejecutar `portal.spec.ts` contra la BD (criterios 2–7) y cerrar la tarea; si falla algo, se corrige con una migración `0003`, nunca editando `0002`. |
| T11 — Enlace para el cliente | Pendiente | | |
| T12 — Portal del cliente (lectura) | Pendiente | | |
| T13 — Portal: aprobar y rechazar | Pendiente | | |
| T14 — Aviso en vivo (Realtime) | Pendiente | | |
| T15 — Pulido final | Pendiente | | |

## Pendiente de tener en cuenta

- Directriz 20 y `.env.example`: resuelto. La directriz permite `.env.example` (solo nombres de variables, sin valores) y `.claude/settings.json` ya no bloquea su lectura. Revisado en `docs/revisiones/ajuste-env-example-vuelta1.md`.
- Los tests de RLS (y los E2E que usen la BD) dejan filas `E2E…` en Supabase porque el taller no puede borrar órdenes; volver a ejecutar `supabase/seed.sql` las limpia.
- Supabase limita los inicios de sesión: no conviene lanzar `npm run test:e2e` muchas veces seguidas.
- `next dev` muestra el aviso "unstable value Date.now() while prerendering" en `<WorkshopName />` (supabase-js usa `Date.now`). `testing` lo revisó en T5: ruido de la validación de prerender en desarrollo, no aparece en `build` y no afecta a la corrección ni a la seguridad.
- Los E2E hacen unos 3 inicios de sesión reales por ejecución (setup, credenciales incorrectas y flujo login/logout). Cuidado con el límite de Supabase.
- Next no deja arrancar dos `next dev` en la misma carpeta: si hay uno abierto, el `webServer` de Playwright (puerto 3100) falla. Cierra tu servidor dev antes de lanzar `npm run test:e2e`.
- Tablero (T6): con 300 órdenes o 200 ids de coincidencia previa corta sin avisar al usuario (convendría un aviso al llegar al límite), y `ilike '%x%'` no usa los índices btree (aceptable a escala de taller; un índice `pg_trgm` sería una mejora futura). El E2E solo cubre `%` y `_` en la búsqueda; las comas, paréntesis y puntos no inyectan filtros porque `.or()` solo recibe UUID de la BD.
- Acumulación de órdenes E2E (T7): cada ejecución completa del E2E crea ~4 órdenes `E2E…` que el taller no puede borrar (sin política delete, sin `service_role`). El tablero limita a 300 órdenes por `created_at` descendente; con ~290 órdenes E2E acumuladas (unas 60–70 ejecuciones) dejarían de verse las del seed y fallarían los tests del tablero que buscan órdenes del seed sin `?q=` ("criterio 1", "criterio 6" y el de 360 px). Se recupera ejecutando `supabase/seed.sql`, que limpia las filas E2E.
- 404 de la ficha (T8): una orden de otro taller o un id que no es uuid se muestra como página "404 · Orden no encontrada" pero con HTTP 200 y `noindex`, porque con `cacheComponents` el `notFound()` se ejecuta dentro de `<Suspense>` con la respuesta ya iniciada (lo documenta Next en `not-found.md` y `streaming.md`). `testing` lo dio por válido tras comprobarlo con `curl`: no se filtra ningún dato de la orden ajena y sin sesión redirige a `/login` (307). Un 404 real exigiría consultar la BD en `proxy.ts`.
- T10 (observaciones de `testing`, sin bloquear): el test concurrente de `portal.spec.ts` acepta 'duplicate key' o 'deadlock' y solo exige `tokens.length >= 1`; garantiza el invariante de la BD pero no detectaría que se perdiera el bloqueo de la función. Tras aplicar la migración y ver que pasa, endurecerlo a `tokens.length === 2`. Ningún test prueba `p_ttl_days = null` (el SQL lo rechaza); los SQLSTATE y mensajes de error de PostgREST que asertan los tests no se pueden comprobar hasta aplicar la migración; `portal.spec.ts` crea unas 17 órdenes E2E por ejecución (se suman a la acumulación anotada arriba).
- T10 y T14: `0002` escribe además los eventos `enlace_creado` y `enlace_revocado` (válidos en `0001`, ya los pinta `src/domain/order-detail.ts`) y estos también viajarán por Realtime: el aviso en vivo de T14 debe filtrar por `type = 'decision'`.
- Si la publicación `supabase_realtime` no existiera, `0002` solo avisa con un NOTICE y habría que añadir `order_lines` y `order_events` a mano antes de T14.
- Observaciones menores de `testing` en T3 (sin bloquear): el `insert({})` de anon solo comprueba que hay error, no su código; el test de borrado de orden admite error o 0 filas.
- Aviso de Next: ignora un `package-lock.json` en `C:\Users\Wilson`; se arreglaría con `turbopack.root` (no tocado).

- T10: `public_links` permite insert y update directos a `authenticated`; restringirlo a las funciones `create_public_link` y `revoke_public_link` (observación de `testing` en T1).
