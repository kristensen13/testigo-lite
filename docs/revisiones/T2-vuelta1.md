# Revisión T2, vuelta 1

Resultado global: APROBADO

| Directriz / criterio | Resultado | Evidencia |
|---|---|---|
| 1 lint | Cumple | `npm run lint` sin salida de errores ni warnings |
| 2 tsc | Cumple | `npx tsc --noEmit` sin salida |
| 3 build / crit. 5 | Cumple | `npm run build` OK; aparece `Proxy (Middleware)`, es decir `src/proxy.ts` (API de Next 16) |
| 4 any / ts-ignore / eslint-disable | Cumple | `git grep` en src y e2e sin coincidencias |
| 11 scripts / crit. 1 | Cumple | `test` y `test:e2e` en package.json; `npm test` 3/3 verdes; `npm run test:e2e` 2/2 verdes |
| Crit. 2 redirección `/` a `/login` | Cumple | test E2E "sin sesión, / redirige a /login" en verde |
| Crit. 4 cabeceras `/p/x` | Cumple | test E2E comprueba referrer-policy, x-robots-tag y cache-control; next.config.ts:9-14 |
| 18 secretos | Cumple | greps sin coincidencias reales (solo hashes `eyJ` de integrity en package-lock.json) |
| 19 / crit. 3 service_role | Cumple | solo aparece en documentos (.md) que lo prohíben; ninguno en código |
| 20 .env versionado | Cumple | `git ls-files \| grep -i "^\.env"` vacío; .gitignore con `.env*` y excepción `!.env.example`. No se ha leído ningún .env* (el acceso a .env.example se denegó y no era necesario) |
| 21 NEXT_PUBLIC_* | Cumple | solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en todo el repo |
| 31 Server Components | Cumple | layout, page y login sin `"use client"` |
| 8 migraciones | Cumple | `git status`/`git diff` de supabase/ vacíos |
| Varios | Cumple | `lang="es"`, fuentes con next/font, formato es-ES con test, textos en castellano, contraste de --muted (#4b5563) sobre fondos claros suficiente, foco visible definido |

Sin fallos.
