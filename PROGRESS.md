# Progreso

| Tarea | Estado | Vueltas de revisión | Notas |
|---|---|---|---|
| T1 — Base de datos | Hecha | 1 | Aprobada a la primera. Informe: `docs/revisiones/T1-vuelta1.md`. El SQL solo se ha revisado por lectura; la prueba real contra la BD es T3. |
| T2 — Andamiaje | Pendiente | | |
| T3 — Test de RLS con clave anon | Pendiente | | Pausa del usuario: aplicar `0001_init.sql` y `seed.sql`, crear usuarios y rellenar `.env.local`. |
| T4 — Dominio | Pendiente | | |
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

- T10: `public_links` permite insert y update directos a `authenticated`; restringirlo a las funciones `create_public_link` y `revoke_public_link` (observación de `testing` en T1).
