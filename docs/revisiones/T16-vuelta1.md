# T16 - vuelta 1 - APROBADO

Ejecutado: lint (0 avisos), tsc (0 errores), npm test (23 archivos, 294 tests), npm run build OK, npm run test:e2e completo (setup + chromium + rls, 4 workers): 128 passed, incluido e2e/tablero-entregadas.spec.ts. Sin next dev ajeno previo; puerto 3100 libre al terminar.

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3 | Cumple | lint, tsc, build ejecutados |
| 4 | Cumple | sin any/ts-ignore nuevos (lint limpio) |
| 6 | Cumple | límites, corte, avisos y vista en src/domain/board-limits.ts (puro; usa solo zod) |
| 7 | Cumple | `entregadas` validado con zod (parseBoardView); q con parseBoardSearch |
| 8 | Cumple | git diff sin cambios en migraciones, playwright.config.ts ni session.ts |
| 9, 12 | Cumple | tests de dominio, consultas (criterios 4, 5, 6) y render del aviso/enlace |
| 10, 11 | Cumple | 128 E2E verdes; criterios 1, 2, 3, 8 cubiertos en e2e/tablero-entregadas.spec.ts |
| 13-17, 20, 21 | Sin cambios | sin migraciones nuevas; seed sin secretos |
| 18, 19 | Cumple | git grep sin coincidencias reales ni service_role en código |
| 22-26 | Cumple | axe (tablero con enlace, anteriores, vacío), 360 px, objetivos >= 44 px y teclado en E2E |
| 27, 28, 29 | Cumple | Suspense "Cargando órdenes…", vacíos en ambas vistas, textos en castellano |
| 31 | Cumple | board-notices.tsx y page.tsx son Server Components, sin "use client" nuevo |
| 33 | Cumple | columnas necesarias; 3 consultas sin búsqueda, 5 con ella, 1/3 anteriores (tests con 2 y 50 órdenes) |
| 34 | Cumple | índice orders(workshop_id, status) existente; el filtro por updated_at se aplica sobre las filas del taller ya filtradas por estado; sin índice nuevo a escala de un taller |
| 5, 14, 30, 32 | Sin cambios | |

Seed: un único bloque DO (transaccional). Si falla, el `disable trigger` se revierte con el bloque (DDL transaccional en Postgres) y el trigger queda como estaba. Se reactiva dentro del mismo bloque. Órdenes 13/14 con updated_at = created_at + 30 h, es decir ~45 y ~90 días. Matrículas 6150 RTM y 7420 CNP no usadas en e2e/ ni tests/.

Cambios en el árbol: PLAN.md, PRODUCT.md (orquestador), README.md, page.tsx, board.ts(+test), seed.sql y archivos nuevos de T16. Nada inesperado.

Observaciones (no son fallos):
1. Aviso de 300 entregadas recientes ("usa el buscador"): la búsqueda se aplica en SQL antes del límite, así que una entrega reciente concreta siempre se encuentra salvo que la propia búsqueda dé más de 300 coincidencias. El texto no engaña; el enlace a anteriores no recupera esas filas, pero el aviso no lo sugiere.
2. En src/lib/board.ts, ID_LIMIT = 200 recorta en silencio los ids de vehículos y clientes de una búsqueda muy amplia (comportamiento previo, fuera del contrato de T16).
3. Los E2E imprimen en el log del servidor dev un error de Date.now() en TallerLayout (src/app/(taller)/layout.tsx:24), ajeno a T16 y que no hace fallar nada.
