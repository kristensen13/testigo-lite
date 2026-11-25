# T15 - vuelta 3 - FALLOS

## Resultado global
No aprobada: 1 fallo (directriz 10). Reproducible 2 de 2 en la suite completa con 4 workers; pasa aislado.

## Comandos
| Comando | Resultado |
|---|---|
| npm run lint | OK |
| npx tsc --noEmit | OK |
| npm test | 21 ficheros, 267 tests OK |
| npm run build | OK |
| npm run test:e2e (completo, ejecucion 1) | 1 failed, 2 did not run, 117 passed. TIEMPOS: criterio 1 aviso 15 ms, chip 1031 ms; criterio 2 decision/fecha/historial ~1028 ms, aviso -469 ms |
| npm run test:e2e (completo, ejecucion 2) | mismo fallo. criterio 1 aviso 6 ms, chip 1542 ms; criterio 2 ~1020 ms, aviso -446 ms |
| en-vivo.spec.ts aislado en frio | 8 passed (59 s). criterio 1 aviso -94 ms, chip 1023 ms; criterio 2 ~1022 ms, aviso 549 ms |

Sin next dev ajeno antes; puertos 3000/3100 libres al terminar; sin procesos propios. No lei .env.local.

## Fallo
F1. Directriz 10. e2e/en-vivo.spec.ts:320 (test "enlace_creado y enlace_revocado no muestran ningun aviso"): `expect(await avisosVistos(page)).toBe(0)` recibe 2. Tipo: asercion (no atasco, no timeout de goto). Reproducible 2/2 en `npm run test:e2e` completo; aislado (spec entero) pasa. Causa probable: el tablero con `?q=<matricula>` recibe por Realtime los avisos de decisiones de otros specs que corren en paralelo en el mismo taller (decision/portal/flujo-completo), porque el aviso llega a todo el taller y el test cuenta todos los avisos vistos, no solo los de su orden. El test no esta aislado de la concurrencia (con 4 workers los solapes cambian respecto a la vuelta 2). Reproducir: `npm run test:e2e`. Solucion posible: contar solo avisos con la descripcion de este spec o filtrar por A/B/C; o ejecutar la suite en-vivo sin solape con otros specs que decidan trabajos.

## Revision especifica
- (a) en-vivo.spec.ts: aviso < 5000 ms estricto desde `guardada` en criterios 1 y 2 (lineas ~205 y ~245); chip/linea/fecha/historial con 30 s sin recargar, tiempo registrado con console.log; __sinRecarga sigue comprobandose; aria-live, castellano, boton >= 44 px, cierre Enter/Espacio, taller 2, canal unico, enlace_*, NEXT_PUBLIC_* intactos. Sin retries/force/skip/fixme. Los `.catch(() => undefined)` solo evitan rechazos: tChipA, tGuardadaA/B y pFicha se esperan despues con await. Puede fallar de verdad (aviso > 5 s o chip > 30 s). setTimeout(120_000) razonable. Observacion: como el aviso se mide al ser visible y la comprobacion es posterior, pasa con aviso negativo (Realtime antes de la confirmacion de la accion), coherente con el umbral.
- (b) playwright.config.ts: solo `workers: 4` + comentario; webServer `npm run dev`; sin retries.
- (c) PLAN.md T14 criterios 1 y 2 coherentes con el test. README/PRODUCT no contradicen (PRODUCT sin modificar).
- (e) PROGRESS/PRODUCT/DIRECTRICES sin modificar; session.ts sin cambios respecto a HEAD; sin migraciones nuevas (solo 0001 y 0002); solo .env.example versionado; sin service_role en codigo (aparece solo en docs/.env.example/.claude como prohibicion, igual que en vueltas previas).

## Tabla de 34 directrices
Igual que T15-vuelta1.md (cumplen todas) salvo:
- 10: NO CUMPLE (F1: `npm run test:e2e` falla 2/2).
- 12: criterio 4/5 de T14 y enlace_* siguen con test, pero el de enlace_* no es estable en suite (ligado a F1).
Resto (1-9, 11, 13-34): cumplen; lint, tsc, test y build verdes.
