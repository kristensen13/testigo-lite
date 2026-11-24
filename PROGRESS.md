# Progreso

| Tarea | Estado | Vueltas de revisión | Notas |
|---|---|---|---|
| T1 — Base de datos | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T1-vuelta1.md`. El SQL solo se ha revisado por lectura; la prueba real contra la BD es T3. |
| T2 — Andamiaje | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T2-vuelta1.md`. `.env.example` creado pero **sin versionar** (conflicto con la directriz 20, pendiente de decisión del usuario). Playwright usa el puerto 3100. |
| T3 — Test de RLS con clave anon | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T3-vuelta1.md`. 34 tests de RLS en verde contra la BD real: `0001_init.sql` no ha necesitado cambios. Script `npm run test:rls`. |
| T4 — Dominio | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T4-vuelta1.md`. 106 tests de Vitest. Tipo `Result` para errores de entrada. |
| T5 — Login y rutas protegidas | Pendiente | | |
| T6 — Tablero con buscador | Pendiente | | |
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
- Observaciones menores de `testing` en T3 (sin bloquear): el `insert({})` de anon solo comprueba que hay error, no su código; el test de borrado de orden admite error o 0 filas.
- Aviso de Next: ignora un `package-lock.json` en `C:\Users\Wilson`; se arreglaría con `turbopack.root` (no tocado).

- T10: `public_links` permite insert y update directos a `authenticated`; restringirlo a las funciones `create_public_link` y `revoke_public_link` (observación de `testing` en T1).
