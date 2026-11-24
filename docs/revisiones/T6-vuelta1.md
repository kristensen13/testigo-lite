# T6 vuelta 1 — APROBADO

Ejecutado: lint (0), tsc (0), npm test (9 ficheros, 136 tests), build (OK), test:e2e --project=chromium (17/17, servidor en frío; puerto 3100 libre después). Sin `next dev` ajeno previo.

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3 | Cumple | comandos anteriores |
| 7 | Cumple | `parseBoardSearch` (zod, safeParse) en el servidor; valor inválido = sin búsqueda |
| 8 | Cumple | git status: sin migraciones ni PLAN/PROGRESS modificados |
| 9, 12 | Cumple | criterios 1-5 con E2E; criterio 6 con test de cliente falso sobre el código real (cuenta consultas ejecutadas con 2 y 50 órdenes; verifica `order_lines(decision)` embebido) más E2E del chip |
| 18-21 | Cumple | greps sin coincidencias reales (solo hash integrity en package-lock y prosa); solo .env.example versionado |
| 22-26 | Cumple | label en el buscador, outline comprobado en E2E, 360 px sin scroll (E2E), min-h-11, estado con texto |
| 27-29 | Cumple | loading.tsx, error.tsx, vacío y sin resultados con acción de limpiar; castellano |
| 31 | Cumple | solo error.tsx y login-form son "use client"; tablero y tarjeta son Server Components |
| 33 | Cumple | columnas mínimas; 1 consulta sin búsqueda, 3 con búsqueda |
| 34 | Cumple con observación | ver abajo |

## Seguridad de la búsqueda
El `.or()` solo recibe UUID obtenidos de la BD (`vehicle_id.in.(...)`), nunca texto del usuario; el texto va como patrón de `.ilike()` (parámetro), con `\ % _` escapados. No hay inyección posible por `, ( ) .`. RLS limita al taller; no hay filtro por workshop_id en cliente.

## Observaciones (no son fallo)
- Límite de 300 órdenes y 200 ids: se corta sin avisar al usuario. Conviene un aviso si se alcanza el límite.
- `ilike '%x%'` sobre plate_norm/name no usa los índices (btree unique y lower(name)); a la escala de un taller (cientos de filas, filtrado antes por RLS/workshop) es aceptable. Un índice pg_trgm sería una mejora futura. Índices de orders (workshop_status, customer, vehicle) y order_lines(order_id) cubren el resto.
- Aviso Date.now() en dev: ya evaluado en T5.
