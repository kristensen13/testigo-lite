# T16b - vuelta 2

Resultado global: APROBADO

## Comandos ejecutados
- npm run lint: sin salida de errores ni warnings.
- npx tsc --noEmit: sin errores.
- npm test: 23 ficheros, 307 tests en verde.
- npm run build: correcto.
- npm run test:e2e completo (setup + chromium + rls): 128 passed (2.0m), a la primera. Durante la ejecucion el WebServer imprimio avisos de `Date.now()` en `src/app/(taller)/layout.tsx` (modo dev; fichero sin tocar en el diff, no hizo fallar ningun test).
- Sin `next dev` ajeno en 3000/3001/3100 antes y despues; no queda ningun proceso mio.

## Verificaciones
1. Fallo de la vuelta 1 corregido: OPEN_ORDERS_LIMIT = 500, fetchSize(500) = 501 < 1000; el texto del aviso sale de la constante (test espera "Se muestran las 500 ..."). `git grep "1000\b|1\.000|1001"`: sin menciones residuales al limite de abiertas en src, e2e, tests, README, PLAN.md ni PRODUCT.md. Coincidencias restantes: POSTGREST_DEFAULT_MAX_ROWS = 1000, texto de PLAN.md ("inicialmente 1000; bajado en T16b"), nota de README sobre Max rows, y cantidades sin relacion (qty_milli, ms, etc.). Unica mencion obsoleta: PROGRESS.md lineas 20 y 41 (historico de T16, "limite 1000"); es del orquestador, no bloquea.
2. El it.each recorre OPEN, RECENT_DELIVERED, PREVIOUS_DELIVERED e ID_LIMIT importados del modulo real y exige fetchSize(limit) < 1000. Con 1000 daria 1001 < 1000 = falso, y con 999 daria 1000 < 1000 = falso: falla.
3. Las consultas piden 501, 301, 201 y 201 (ID_LIMIT+1 en board.ts:71 para vehiculos y clientes): todas < 1000.
4. T16b intacto: ID_LIMIT exportado desde board-limits.ts, aviso "Hay demasiadas coincidencias, afina la búsqueda" una sola vez (test), page.tsx pasa `coincidencias` en ambas vistas; engines ">=22.12" en package.json y package-lock.json (3 lineas cada uno); numero de consultas fijo (2 de ids en paralelo + listas).
5. README: nota de Max rows correcta (Project Settings -> API, bajar limites si Max rows < 501); "hasta 500" coherente.
6. El diff no toca playwright.config.ts, src/lib/session.ts, supabase/, DIRECTRICES.md ni PROGRESS.md.
7. Seguridad: git grep de secretos y eyJ sin coincidencias reales; service_role solo en texto de docs/comentarios; solo .env.example versionado y sin valores (0 lineas con valor).

## Directrices
| Nº | Resultado | Evidencia |
|---|---|---|
| 1, 2, 3 | Cumple | lint, tsc, build ejecutados |
| 4 | Cumple | sin any/ts-ignore nuevos en el diff |
| 6 | Cumple | limites y avisos en src/domain |
| 7 | Cumple | sin Server Actions nuevas; `q` ya validado/normalizado por buildSearchTerms, y `entregadas` por zod (parseBoardView) |
| 8 | Cumple | sin cambios en supabase/ |
| 9-12 | Cumple | 307 tests; e2e 128 OK; test nuevo por criterio |
| 18-21 | Cumple | greps vacios, .env.example sin valores |
| 22-26 | Cumple | e2e incluye 360 px sin scroll; avisos con role="status" |
| 27-29 | Cumple | avisos en castellano, estados vacios intactos |
| 31 | Cumple | page.tsx sigue siendo Server Component |
| 33 | Cumple | columnas explicitas, numero fijo de consultas |
| 34 | Cumple | sin consultas nuevas por columnas sin indice (plate_norm/name ya existian de T16) |
