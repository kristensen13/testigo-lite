# T8 - vuelta 1: APROBADO

Ejecutado: lint (0), tsc (0), npm test (12 ficheros, 157 tests), build OK, e2e chromium 27/27 (servidor en frío), rls cambio-estado 1/1. Puertos 3000/3100/3101 libres al terminar.

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3 | Cumple | lint, tsc y build sin errores |
| 7 | Cumple | changeOrderStatus parsea con zod (parseChangeStatus) en servidor antes de consultar |
| 14 | Cumple | sesión del usuario; RLS oculta órdenes ajenas; e2e taller 2 |
| 4,19 | Cumple | sin service_role en código; sin any/ts-ignore |
| 6 | Cumple | transiciones y historial en src/domain |
| 9 | Cumple | order-detail.test.ts y change-status.test.ts |
| 10,12 | Cumple | e2e/ficha-orden.spec.ts cubre criterios 1-5 + 360 px; spec de BD |
| 18-21 | Cumple | greps vacíos (eyJ solo integrity de package-lock); solo .env.example versionado |
| 22-26 | Cumple | botones con nombre, :focus-visible global, estado con texto + icono, 360 px verificado, min-h-11 |
| 27-29 | Cumple | loading/error/not-found en castellano; error de acción con role=alert |
| 31 | Cumple | use client solo en status-buttons y error.tsx |
| 33 | Cumple | 2 consultas (orden con embebidos + eventos), columnas explícitas |
| 8 | Cumple | git status: solo ficheros nuevos, sin migraciones ni PLAN modificados |

## Criterio 2
change-status.test.ts: la transición no adyacente, Entregado, id/estado inválidos, orden inexistente y 0 filas afectadas devuelven error y no llaman a update. El spec de BD prueba que el salto recibido->listo falla en la BD y el estado queda igual; el adyacente genera el evento por trigger. El update usa .eq("status", from) y comprueba filas.

## Criterio 5 (404 con HTTP 200)
Comprobado con curl sobre next start con sesión: la orden del taller 2 y un id no uuid devuelven HTTP 200 con el cuerpo 404, meta robots noindex; el HTML no contiene "Hugo Sanz" (0 coincidencias). Sin sesión: 307 a /login. Una ruta inexistente da 404 real.
Motivo: con cacheComponents la lectura de sesión/BD ocurre dentro de Suspense, y la doc de Next (not-found.md, streaming.md) dice que tras empezar el streaming el estado queda en 200 y se inyecta noindex. Un 404 real exigiría leer cookies/BD fuera de Suspense (no permitido con cacheComponents) o consultar en proxy. Se acepta: página privada tras login, no indexable, sin fuga de datos ajenos, comportamiento documentado del framework, y el test verifica el 404 visible.

## Notas (no bloqueantes)
- El servidor dev emite avisos "Date.now() while prerendering" en src/app/(taller)/layout.tsx:23 (WorkshopName), ajenos a T8; los tests pasan.
- Los E2E crean una orden propia y solo cambian su estado; no tocan las del seed ni cuentan órdenes del tablero.
