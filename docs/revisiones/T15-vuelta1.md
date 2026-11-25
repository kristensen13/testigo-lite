# T15 — vuelta 1 — FALLOS

## Resultado global

No aprobada. Dos fallos:

1. `npm run test:e2e` no termina en verde (criterio 5 de T15, directriz 10).
2. El README dice "Node.js 20 o superior" y no es cierto (criterio 4 de T15).

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npm run lint` | OK, sin avisos |
| `npx tsc --noEmit` | OK |
| `npm test` | 21 ficheros, 267 tests en verde |
| `npm run build` | OK. `/p/[token]`, `/ordenes/[id]` y el resto compilan con PPR; el proxy se detecta. |
| `npm run test:e2e` (completo, 1.ª vez) | 120 tests: 113 OK, 2 fallos, 5 sin ejecutar. Los 57 del proyecto rls pasan. |
| Repetición aislada de `e2e/nueva-orden.spec.ts` + `e2e/en-vivo.spec.ts` | `nueva-orden` 3/3 OK (inestabilidad por carga). `en-vivo` falla en otro punto: "criterios 2 y 3" (timeout 60 s esperando el botón "Cerrar aviso"; en el log aparece `[en vivo] canal no disponible (TIMED_OUT)`). |
| Repetición aislada de `e2e/en-vivo.spec.ts` | Falla otra vez en "criterios 1 y 3": `chip +8656 ms, aviso +-498 ms` (límite 5000 ms). |

El entorno estaba limpio: no había `next dev` ajeno ni puertos 3000/3100 en escucha. Después de las ejecuciones solo quedan conexiones en TIME_WAIT, ningún LISTEN, y no he dejado procesos propios. No he leído `.env.local`.

## Fallos

### F1. `npm run test:e2e` no queda en verde (directriz 10; criterio 5 de T15)

- `e2e/en-vivo.spec.ts:171` (test "criterios 1 y 3", T14). El chip del tablero tarda más de 5 s en actualizarse tras la decisión del cliente.
  - Ejecución completa: `chip +6678 ms`.
  - Aislado, 2.ª ejecución: `chip +8656 ms`.
  - El aviso llega al momento (el valor es negativo porque `guardada` se resuelve después). Lo lento es el `router.refresh()` del tablero en dev.
- `e2e/en-vivo.spec.ts:215` ("criterios 2 y 3", serial). Con el test anterior pasando, falló en una ejecución aislada con timeout de 60 s esperando `getByRole("button", { name: "Cerrar aviso" })` en el aviso "El cliente ha rechazado «Correa de servicio»". En el log salió `canal no disponible (TIMED_OUT)` (`src/components/live-updates.tsx:99`).
- Como el spec es `serial`, un fallo deja 4–5 tests sin ejecutar.
- Es reproducible en solitario: `npx playwright test --project=chromium e2e/en-vivo.spec.ts` falló en las dos ejecuciones aisladas, aunque en puntos distintos. T14 lo había dado en verde (57/57), así que algo ha cambiado desde entonces. Candidatos que he visto, sin poder aislarlos:
  - `await connection()` en `createClient()` (`src/lib/supabase/server.ts`), que vuelve dinámico y más lento el `router.refresh()`.
  - Los cambios de T15 en `src/proxy.ts`.
  - Carga o límites del Realtime de Supabase.
  - Los dos tests de en-vivo esperan activamente y no son estables en este entorno.
- `e2e/nueva-orden.spec.ts:38` ("criterios 1, 3 y 4") falló solo en la ejecución completa (URL se quedó en `/ordenes/nueva`, 20 s) y pasó al repetirlo. Lo trato como inestabilidad por carga del servidor dev (12 workers), no como fallo propio.

Cómo reproducirlo:

```
npx playwright test --project=chromium e2e/en-vivo.spec.ts
```

### F2. README: "Node.js 20 o superior" es falso (criterio 4 de T15)

- `README.md:7`: dice "Node.js 20 o superior".
- `node_modules/vitest/package.json` (`engines.node`) exige `^22.12.0 || ^24.0.0 || >=26.0.0`. `@axe-core/playwright` (`package-lock.json`) exige `>=22.12.0`. Con Node 20, `npm test` y los E2E no están soportados.
- Corrección: indicar Node 22.12 o superior (o 24, que es lo que se ha usado: v24.22.1).

Cómo comprobarlo: `grep -n '"node"' node_modules/vitest/package.json` y `grep -n engines -A2 node_modules/@axe-core/playwright/package.json`.

## Tabla de directrices (repaso global)

| Nº | Resultado | Evidencia |
|---|---|---|
| 1 | Cumple | `npm run lint` sin salida de error ni avisos |
| 2 | Cumple | `npx tsc --noEmit` exit 0 |
| 3 | Cumple | `npm run build` OK |
| 4 | Cumple | `grep -E "\bany\b\|@ts-ignore\|@ts-expect-error\|eslint-disable"` sobre `src`, `e2e`, `tests`: vacío |
| 5 | Cumple | `Number()` solo sobre dígitos o bigint (`src/domain/money.ts:32`, `src/domain/totals.ts:41,48`, `src/domain/portal-decision.ts:66`). `Math.round` en `src/domain/order-lines.ts:163` es para centésimas de cantidad, no de importe. Sin `parseFloat` ni `toFixed` |
| 6 | Cumple | `grep 'from "(next\|@supabase\|react)' src/domain`: vacío |
| 7 | Cumple | Acciones con zod: `nueva/actions.ts`, `[id]/actions.ts`, `enlace-actions.ts`, `lineas-actions.ts`, `login/actions.ts`, `p/[token]/actions.ts`. El único route handler es `logout/route.ts`, sin entrada de usuario |
| 8 | Cumple | `git status` sin migraciones modificadas; `git log -- supabase/migrations`: 0001 (52967f4), 0002 (047a544, 27ce829), sin cambios posteriores a su aplicación |
| 9 | Cumple | 267 tests de Vitest en verde, con dominio y `src/lib` |
| 10 | NO cumple | Ver F1 |
| 11 | Cumple | `test` y `test:e2e` en `package.json` (más `test:rls`) |
| 12 | Cumple (con reserva) | Cada spec nombra sus criterios. Los de T14 están cubiertos por tests que hoy fallan (F1) |
| 13 | Cumple | RLS en todas las tablas (`0001_init.sql`, probado en `tests/rls`; 57 tests rls en verde) |
| 14 | Cumple | `tests/rls/aislamiento.spec.ts` en verde |
| 15 | Cumple | `gen_random_bytes(32)` en `0002_portal.sql:156` (256 bits, 64 hex) |
| 16 | Cumple | `portal_get` con lista blanca (`tests/rls/portal.spec.ts` en verde) |
| 17 | Cumple | Caducidad y revocación en `tests/rls/portal.spec.ts` y `e2e/portal.spec.ts` (verdes) |
| 18 | Cumple | `git grep` de secretos vacío; `eyJ` solo en el `integrity` de `package-lock.json:5670` |
| 19 | Cumple | `git grep -ni service_role`: solo prosa en documentos, agentes, README y un comentario de `.env.example`. Ni en `src` ni en SQL ni en tests |
| 20 | Cumple | `git ls-files \| grep -i "^\.env"` solo `.env.example`; contiene solo nombres con valor vacío (6 variables). `.env.local` no leído |
| 21 | Cumple | `src/lib/env.ts` solo lee `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 22 | Cumple | axe sin violaciones (incluye `label`) en login, nueva orden, ficha |
| 23 | Cumple | axe `wcag2aa` (`color-contrast`) en login, tablero, ficha, portal y 404 pasó; tests de contraste de T12 |
| 24 | Cumple | Tests de teclado en tablero, nueva orden, enlace y avisos |
| 25 | Cumple | 360 px sin scroll horizontal en tablero, nueva orden, ficha, presupuesto y portal (`flujo-completo` también lo comprueba) |
| 26 | Cumple | axe (`button-name`, `image-alt`); sin imágenes en `src` |
| 27 | Cumple | `loading.tsx` en `(taller)`, `ordenes/[id]`, `ordenes/nueva` y `p/[token]`; `error.tsx` en `(taller)`, `ordenes/[id]`, `login` y `p/[token]`; `not-found.tsx` global y de la ficha; `global-error.tsx`. Los formularios muestran sus errores |
| 28 | Cumple | Tests de estado vacío (tablero, presupuesto) |
| 29 | Cumple | `not-found.tsx` y `global-error.tsx` en castellano; el resto, por lectura y E2E |
| 30 | Cumple | `nueva-orden` criterio 2 y `presupuesto` criterio 2 verdes |
| 31 | Cumple | Cada `"use client"` es un componente pequeño: `error.tsx` (x4), `global-error.tsx`, `nueva-orden-form`, `enlace-acciones`, `linea-forms`, `status-buttons`, `login-form`, `decision-actions`, `live-updates` |
| 32 | Cumple | No hay imágenes (`grep "<img\|next/image"` vacío). Dependencias ligeras |
| 33 | Cumple | `.select(` con columnas explícitas; sin `select *`; el tablero usa 1 o 3 consultas, sin N+1 |
| 34 | Cumple | Índices de `0001_init.sql` y `public_links(token_hash)` único y `public_links(order_id)` |

## Revisión específica de T15

- (a) `e2e/flujo-completo.spec.ts`: PASA en la ejecución completa (1,1 min). Inicia sesión por la UI en un contexto limpio; crea la orden y el presupuesto con tres trabajos; pasa a Esperando aprobación; genera el enlace. Con el cliente a 360 px aprueba y rechaza, y comprueba aviso, chip "1/3" y "2/3", ficha, historial y la ausencia de recarga con un marcador `window`. Puede fallar de verdad y no imprime credenciales ni tokens.
- (b) `e2e/accesibilidad.spec.ts`: PASA. Usa las etiquetas wcag2a/2aa/21a/21aa/22aa y filtra serious/critical. No hay `disableRules` ni `exclude`. Espera contenido visible (botón Entrar, tarjeta de la orden, botón Aprobar, heading) antes de analizar. Cubre login (también con error), ficha, tablero, nueva orden, portal a 360 px (también con la confirmación abierta y con el enlace no disponible) y 404.
- (c) `src/app/not-found.tsx` y `src/app/global-error.tsx`: en castellano, con `<html lang="es">` y `<body>` propios en global-error. Usa `retry`, que es lo que documenta Next 16.4 (`error.md`). No afectan a `ordenes/[id]/not-found.tsx` ni al portal.
- (d1) `tests/rls/portal.spec.ts`: endurecido a `tokens.length === 2`, `error` nulo en ambas llamadas y el patrón tolerado eliminado. Pasa contra la BD real.
- (d2) `await connection()` en `createClient()`: es el uso documentado (`connection.md`). El build pasa y las rutas siguen como PPR. En los logs del servidor dev de la ejecución completa (tablero y ficha con sesión) no aparece ningún aviso `Date.now()` ni `blocking-prerender`. Posible efecto en el tiempo de `router.refresh()`: ver F1.
- (d3) `src/proxy.ts` sale pronto en `/p/*`. El test nuevo de `portal.spec.ts` pasa: mismas cabeceras (`no-referrer`, `noindex, nofollow`, `no-store`), sin `Set-Cookie`, misma página con y sin sesión, y `/` sin sesión da 307 a `/login`. `/ordenes/*` y `/logout` siguen en el camino protegido (sin cambios de lógica).
- (e) README: pasos de Supabase, 6 variables, scripts, puerto 3100, límite de inicios de sesión, órdenes E2E y que el seed las limpia (borra los talleres por cascada), arquitectura, seguridad del portal (64 hex, SHA-256, 7 días, revocación) y despliegue: todo coincide con el código. `grep` sobre `src` de `signInWith|signUp|exchangeCodeForSession|emailRedirectTo|resetPasswordForEmail|verifyOtp`: solo `signInWithPassword` (`src/app/login/actions.ts:26`) y `signOut` (`src/app/logout/route.ts:13`), así que la sección de Auth → URL Configuration es correcta. El origen del enlace sale de las cabeceras (`enlace-actions.ts:32-34`). Único fallo: F2.
- (f) `git status`: ningún documento del plan ni migración modificado. Dependencia nueva: solo `@axe-core/playwright` en `devDependencies` (`package.json` y lock). Los cambios son los `git add -N` esperados.

## Observación sin bloquear

En la ejecución completa apareció en el log del navegador "The server could not finish this Suspense boundary... Switched to client rendering" una vez, sin test fallido asociado. No lo he podido atribuir.
