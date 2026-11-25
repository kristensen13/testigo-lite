# T15 - vuelta 4 - APROBADO

## Comandos
| Comando | Resultado |
|---|---|
| npm run lint | OK |
| npx tsc --noEmit | OK |
| npm test | 21 ficheros, 267 tests OK |
| npm run build | OK |
| npm run test:e2e (completo, 4 workers) | 120 passed (1.9 min). TIEMPOS: criterio 1 aviso -605 ms, chip 1523 ms; criterio 2 decision/fecha/historial ~1530 ms, aviso 48 ms |

El log del test de enlaces mostro los avisos ajenos: «Sustitución de embrague» y «Kit de distribución» (flujo-completo), ignorados correctamente. Sin next dev ajeno antes; puertos 3000/3100 libres al terminar; sin procesos propios. No lei .env.local.

## Revision especifica
- (a) Enlaces: el E2E filtra por A/B/C propias o "enlace" y espera positiva de frames enlace_creado/revocado. Observacion: el E2E por si solo podria pasar trivialmente ante enlace_* tratado como decision (daria refresh:true, notice:null, sin aviso). Lo cubre src/domain/live-updates.test.ts:21 (`toEqual({refresh:false, notice:null})` para ambos tipos), que fallaria con refresh:true. Combinacion honesta; no es fallo.
- (b) Auditoria: en el resto de specs no hay contadores globales de avisos ni "unico aviso"; los conteos de tarjetas van filtrados por matricula unica (nueva-orden, tablero, decision) y el role=status de enlace-cliente esta acotado a su seccion. Sin aserciones frágiles. Limite de 3 avisos apilados: solo afectaria si 3 avisos ajenos llegan despues del propio en milisegundos; documentado, inverosimil. Observacion menor: el filtro /enlace/i fallaria si otro spec decidiera una linea cuya descripcion contenga "enlace"; hoy ninguna lo hace.
- (c) A, B, C de en-vivo ("Revisión del alternador", "Correa de servicio", "Escobillas limpiaparabrisas") aparecen solo en e2e/en-vivo.spec.ts.
- (d) Umbral < 5000 ms estricto (lineas 211 y 252); esperas de 30 s con __sinRecarga y tiempos registrados; workers 4; webServer npm run dev; sin retries; session.ts sin cambios; README Node 22.12; sin connection() (solo un comentario).
- (f) PROGRESS/PRODUCT/DIRECTRICES/session.ts sin modificar; migraciones solo 0001 y 0002; sin service_role en src/e2e/tests; solo .env.example versionado. El cambio de esta vuelta esta en e2e/en-vivo.spec.ts.

## Tabla de 34 directrices
Igual que T15-vuelta1.md (todas cumplen). Cambian respecto a la vuelta 3:
- 10 (tests E2E pasan): CUMPLE. `npm run test:e2e` completo 120/120.
- 12 (criterios de aceptacion/enlace_* sin aviso): CUMPLE. E2E (ausencia de avisos propios con espera positiva de frames) + unitario live-updates.test.ts:21.
Resto (1-9, 11, 13-34): cumplen; lint, tsc, test y build verdes.
