# T15 - vuelta 2 - FALLOS

## Resultado global
No aprobada: 1 fallo (directriz 10, estabilidad de e2e/en-vivo.spec.ts). El fallo 2 de la vuelta 1 (README, Node) esta corregido.

## Comandos ejecutados
| Comando | Resultado |
|---|---|
| npm run lint | OK |
| npx tsc --noEmit | OK |
| npm test | 21 ficheros, 267 tests OK |
| npm run build | OK (PPR, proxy detectado) |
| npm run test:e2e completo | 120 passed (2.7 min). Tiempos: criterio 1 chip 3553 ms; criterio 2 ficha 1525 ms |
| en-vivo aislado, ejecucion 1 (frio) | 8 passed. chip 1537 ms, aviso -1020 ms; ficha 1035 ms, aviso 574 ms |
| en-vivo aislado, ejecucion 2 (frio) | FALLA: `TIEMPOS criterio 1: aviso -515 ms, chip 10649 ms` (limite 5000). 1 failed, 2 passed (serial: el resto no se ejecuta) |
| en-vivo aislado, ejecucion 3 (repeticion) | 8 passed. chip 3573 ms; ficha 1039 ms, aviso 565 ms |

Entorno: sin LISTEN en 3000/3100 antes ni despues; no arranque nada propio que quede vivo. No lei .env.local.

## Fallo
F1. Directriz 10 (tests E2E en verde y estables). e2e/en-vivo.spec.ts:193-195 (criterio 1 de T14, umbral 5 s). Con el servidor dev en frio el chip del tablero tarda 10,6 s en 1 de 3 ejecuciones aisladas (y 3,5 s en otras dos, con la suite completa tambien 3,5 s). Sin `connection()` sigue habiendo una cola de 10 s, asi que la causa que atribuye develop no explica toda la variabilidad. El test mide bien (falla de verdad); lo que falla es el router.refresh() del tablero en `next dev`, que a veces es lento. Reproducir: `npx playwright test e2e/en-vivo.spec.ts --project=chromium` repetido (falla de forma intermitente, 1 de 3 en mi revision).

## Revision especifica
- (a) server.ts: `connection()` eliminado (git diff solo anade el comentario; no hay import). El comentario es veraz respecto a lo que afirma, pero las cifras "7 de 7 / 5 de 7" no se sostienen: aqui hay un 10,6 s sin connection().
- (b) en-vivo.spec.ts: el umbral sigue en `toBeLessThan(5000)`, medido desde `guardada` (confirmacion del portal) hasta chip/aviso/ficha; no subido. Se mantienen aviso visible, aria-live polite, texto en castellano, boton >=44 px, cierre con Enter/Espacio, chip, ficha, fecha, historial y `__sinRecarga`. Reordenado: aviso primero, chip despues. Ahora la comprobacion final ocurre tras cerrar el aviso, pero el calculo de tiempos se conserva; la prueba falla de verdad (lo hizo). Los `.catch(() => undefined)` en en-vivo.spec.ts:171,173,217,223 solo evitan rechazos sin atender en ramas laterales; las promesas se esperan despues con await, no ocultan fallos.
- (c) Los 45 s son solo en `toHaveURL`/`toHaveCount` tras acciones de servidor; sin force:true, test.skip/fixme ni retries (git grep). playwright.config.ts sin cambios.
- (d) Observacion: connection() en createClient() hace dinamico todo lo que lo llama, pero no hay prueba directa de que alargue el refresh; la bisección de develop (7 y 7 ejecuciones) es pequena y el 10,6 s sin connection() sugiere una causa alternativa (compilacion en frio de rutas en next dev, latencia de Supabase/Realtime, o carga paralela con otros specs). Conviene comprobar con `next build && next start` o aumentar la tolerancia solo si el criterio se mide en produccion.
- (e) README.md:7 dice Node 22.12 o superior; coincide con vitest engines (^22.12.0 || ^24 || >=26) y @axe-core/playwright (>=22.12.0). README no menciona connection() ni Date.now.
- (f) PROGRESS/PLAN/PRODUCT/DIRECTRICES sin modificar; sin migraciones nuevas; sin service_role en src/supabase/tests/e2e; solo .env.example versionado.
- (g) Tabla de 34 directrices: igual que vuelta 1 (T15-vuelta1.md), salvo la 10 = NO cumple (F1). Los cambios de esta vuelta (README, esperas, server.ts) no afectan al resto: lint, tsc, test, build y E2E completo verdes.
