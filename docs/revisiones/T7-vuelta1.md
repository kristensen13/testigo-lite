# T7 vuelta 1 - Resultado: FALLOS (1)

| Dir. | Resultado | Evidencia |
|---|---|---|
| 1 lint | Cumple | npm run lint sin salida |
| 2 tsc | Cumple | npx tsc --noEmit sin errores |
| 3 build | Cumple | npm run build OK |
| 4 any/ignore | Cumple | git grep sin coincidencias en los ficheros nuevos |
| 5, 6 | Cumple | dominio puro en src/domain/new-order.ts |
| 7 zod en servidor | Cumple | actions.ts llama a parseNewOrder (zod); límites iguales a los checks de 0001_init.sql (120/30/20/120/0..3.000.000/2000) |
| 8 migraciones | Cumple | git status: ninguna migración ni documento modificado; solo ficheros nuevos |
| 9 vitest | Cumple | 10 ficheros, 142 tests en verde |
| 10 E2E | NO CUMPLE | npm run test:e2e --project=chromium: 19 pasan, 1 falla (e2e/tablero.spec.ts:71, T6). Reproducible en aislado |
| 12 criterios 1-5 | Cumple | E2E nueva-orden (3 tests) pasan; el criterio 3 se prueba por nombre/modelo actualizados y 2 tarjetas; la prueba directa de no duplicar está en tests/rls/create-order.spec.ts. Suficiente en conjunto |
| 18-21 seguridad | Cumple | greps sin coincidencias reales (eyJ solo integrity de package-lock); service_role solo en prosa; solo .env.example versionado |
| 22 labels | Cumple | todos los campos con label htmlFor; el test comprueba labels.length |
| 24, 25 | Cumple | test teclado + 360 px pasa |
| 27 | Cumple | loading.tsx propio y error.tsx de (taller) |
| 29, 30 | Cumple | textos en castellano; errores junto al campo con aria-invalid/aria-describedby/role=alert; valores conservados |
| 31 | Cumple | "use client" solo en nueva-orden-form.tsx |

## Fallo
El E2E de T7 crea ~4 órdenes por ejecución en la BD real y no las limpia. Ya hay 41 tarjetas "E2E" en la columna Recibido. El test de T6 "criterio 5" (e2e/tablero.spec.ts:71-81) hace como máximo 40 Tab para llegar a la tarjeta "1234 ABC" y ya no lo consigue: falla siempre (confirmado en aislado). La suite global queda en rojo por la contaminación que introduce T7.
