# T16b - vuelta 1

Resultado global: FALLOS (1 fallo real: max_rows por defecto de Supabase hace imposible el aviso de OPEN_ORDERS_LIMIT).

## Ejecutado
- npm run lint: OK. npx tsc --noEmit: OK. npm test: 23 ficheros, 303 tests OK. npm run build: OK.
- npm run test:e2e completo: 128 passed (1.6 min). Ruido WebServer "Date.now() while prerendering" en TallerLayout (no tocado por el diff).
- npm ci --ignore-scripts en copia limpia fuera del repo: OK (404 paquetes), sin avisos de engines (solo deprecación de eslint ya existente).
- Sin servidores propios; ningun puerto 3000-3002/3100 en escucha.

## Criterios T16b
| # | Resultado | Evidencia |
|---|---|---|
| 1 | Cumple | board.test.ts: ID_LIMIT+1 vehiculos/clientes -> searchTruncated; ID_LIMIT exactos no; sin busqueda no |
| 2 | Cumple | test de fetchPreviousDelivered con frontera |
| 3 | Cumple | limit:ID_LIMIT+1 en ambas, max ID_LIMIT ids en el or, 5/3 y 3/1 consultas |
| 4 | Cumple | board-notices.test.ts: role=status, texto exacto, sin duplicado |
| 5 | Cumple | ID_LIMIT exportado en board-limits.ts; sin 200 magico en board.ts |
| 6 | Cumple | engines exacto; package-lock +3 lineas solo engines raiz; README coherente |
| 7 | Cumple | e2e 128/128 |

Directrices 7, 12, 22-29, 31, 33, 34: sin incumplimientos en el diff. No se tocaron playwright.config.ts, session.ts, migraciones, seed ni DIRECTRICES/PROGRESS.

## Fallo
max_rows (PostgREST/Supabase, por defecto 1000): OPEN_ORDERS_LIMIT=1000 -> fetchSize=1001 > 1000, el servidor devuelve como maximo 1000 filas y applyLimit (src/lib/board.ts:175, src/domain/board-limits.ts:4) nunca detecta el recorte: con >1000 abiertas no hay aviso (T16 criterio 5). Las otras consultas (301, 201, ID_LIMIT+1=201) quedan por debajo y funcionan. Los tests con cliente falso no lo detectan.
Soluciones: (a) bajar OPEN_ORDERS_LIMIT a p. ej. 500 (501<1000), actualizar PRODUCT/PLAN/tests; simple y robusta, pero deja de mostrar todas hasta 1000. (b) count exact de PostgREST; mantiene limite, pero cambia el patron y los fakes. Recomendada (a) por sencillez.

## Observaciones
- URL del .or() con 400 uuids (~15 KB): bajo los limites habituales (Node 16 KB de cabeceras; PostgREST/Vercel mas); riesgo bajo pero cercano al limite de 16 KB de Node en cabecera/URL en peticion; no es fallo.
- Orden sin desempate: observacion.
- Texto del aviso veraz: "Se muestran los resultados de las primeras 200 coincidencias de vehiculos y de clientes" es aceptable.
