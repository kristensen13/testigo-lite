# Revisión T5 — vuelta 1

Resultado global: FALLOS (1 fallo, 3 observaciones).

Comandos: lint (0), `npx tsc --noEmit` (0), `npm test` (7 ficheros, 110 verdes), `npm run build` (OK), E2E chromium: 1ª ejecución FALLA en setup (cold start), 2ª ejecución 9/9 verdes. Greps de seguridad limpios (solo hash integrity en package-lock.json), `.env*` solo `.env.example` versionado, `e2e/.auth/` ignorado y fuera del índice, sin cambios en migraciones/PLAN/PROGRESS.

| Dir. | Estado | Evidencia |
|---|---|---|
| 1,2,3 | Cumple | lint/tsc/build OK |
| 4 | Cumple | sin any/ts-ignore/eslint-disable/console |
| 6 | Cumple | `src/domain/login.ts` puro |
| 7 | Cumple | `parseLogin` (zod) en `loginAction`; `/logout` no recibe entrada |
| 9 | Cumple | `login.test.ts`, 110 verdes |
| 10 | NO cumple | 1ª ejecución de `npm run test:e2e -- --project=chromium` falla en `e2e/auth.setup.ts:15` (timeout 5 s por defecto al esperar `workshop-name` con el servidor dev en frío; 2ª ejecución pasa) |
| 12 | Cumple | criterios 1-5 con tests en `e2e/auth.spec.ts` |
| 18-21 | Cumple | greps y `git ls-files` |
| 22 | Cumple | label/for en email y contraseña |
| 24,25 | Cumple | test teclado + 360 px sin scroll; foco visible comprobado |
| 27 | Cumple | loading/error en (taller) y error en login |
| 29,30 | Cumple | textos en castellano; errores junto al campo, email conservado |
| 31 | Cumple | solo `login-form.tsx` y error.tsx son cliente |
| 33 | Cumple | `profiles` -> `workshops(name)` una consulta |

## Fallo
1. Directriz 10, `e2e/auth.setup.ts:15`: `expect(...).toBeVisible()` usa el timeout por defecto (5 s) y el nombre del taller se renderiza en streaming tras ~2-5 s en dev en frío. Reproducir: con puerto 3100 libre, `npm run test:e2e -- --project=chromium` (1ª vez tras arrancar). Corrección: `{ timeout: 20_000 }` como en auth.spec.ts.

## Observaciones
- Aviso `Date.now()` en `<WorkshopName />` (dev): aparece de verdad al servir `/` con sesión, solo en `next dev`; el build no lo emite, la página muestra el taller correcto, `createClient` hace `await cookies()` y `Cache-Control: no-store` está presente. Parece ruido de la validación de prerender de dev (supabase-js usa Date.now); sin fuga de datos ni afectación a corrección. Sin fallo.
- Logout CSRF: POST sin comprobación de Origin, pero las cookies de Supabase son SameSite=Lax, así que un POST cross-site no lleva sesión; GET no cierra sesión. Aceptable.
- `/logout` sin sesión pasa por el proxy y redirige a /login (correcto).
