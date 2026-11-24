# Progreso

| Tarea | Estado | Vueltas de revisión | Notas |
|---|---|---|---|
| T1 — Base de datos | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T1-vuelta1.md`. El SQL solo se ha revisado por lectura; la prueba real contra la BD es T3. |
| T2 — Andamiaje | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T2-vuelta1.md`. `.env.example` creado pero **sin versionar** (conflicto con la directriz 20, pendiente de decisión del usuario). Playwright usa el puerto 3100. |
| T3 — Test de RLS con clave anon | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T3-vuelta1.md`. 34 tests de RLS en verde contra la BD real: `0001_init.sql` no ha necesitado cambios. Script `npm run test:rls`. |
| T4 — Dominio | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T4-vuelta1.md`. 106 tests de Vitest. Tipo `Result` para errores de entrada. |
| T5 — Login y rutas protegidas | Hecha | 2 | Vuelta 1: FALLO (directriz 10, el setup E2E agotaba el timeout de 5 s con el servidor en frío). Vuelta 2: APROBADA. Informes: `docs/revisiones/T5-vuelta1.md` y `T5-vuelta2.md`. Logout como `POST /logout` (route handler). El tablero de `/` es provisional hasta T6. |
| T6 — Tablero con buscador | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T6-vuelta1.md`. 136 tests de Vitest y 17 E2E. Sin N+1: 1 consulta sin búsqueda, 3 con búsqueda. |
| T7 — Nueva orden | Pendiente | | |
| T8 — Ficha de la orden | Pendiente | | |
| T9 — Presupuesto | Pendiente | | |
| T10 — `0002_portal.sql` | Pendiente | | Pausa del usuario: aplicar `0002_portal.sql`. |
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
- Observaciones menores de `testing` en T3 (sin bloquear): el `insert({})` de anon solo comprueba que hay error, no su código; el test de borrado de orden admite error o 0 filas.
- Aviso de Next: ignora un `package-lock.json` en `C:\Users\Wilson`; se arreglaría con `turbopack.root` (no tocado).

- T10: `public_links` permite insert y update directos a `authenticated`; restringirlo a las funciones `create_public_link` y `revoke_public_link` (observación de `testing` en T1).
