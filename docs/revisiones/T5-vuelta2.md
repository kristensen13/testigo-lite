# Revisión T5 — vuelta 2

Resultado global: APROBADO.

Entorno: antes de empezar, ningún proceso escuchaba en los puertos 3xxx (netstat). Tras el E2E tampoco queda ningún servidor dev.

Comandos ejecutados: `npm run lint` (0), `npx tsc --noEmit` (0), `npm test` (7 ficheros, 110 verdes), `npm run build` (OK), `npm run test:e2e -- --project=chromium` con el servidor en frío: 9 passed (37,5 s), a la primera. No se ejecutó el proyecto rls.

| Dir. | Estado | Evidencia |
|---|---|---|
| 1,2,3 | Cumple | lint, tsc y build OK |
| 9 | Cumple | 110 tests verdes |
| 10 | Cumple | E2E en frío 9/9 (el setup ya no falla) |
| 12 | Cumple | criterios 1-5 cubiertos en e2e/auth.spec.ts, sin cambios |
| 18-21 | Cumple | git grep eyJ vacío; service_role solo en prosa de docs/agentes; solo .env.example versionado; e2e/.auth/ ignorado (.gitignore:47) y sin ficheros en el índice |
| Resto (4,6,7,22,24,25,27,29-31,33) | Cumple | sin cambios desde la vuelta 1 |

Corrección: solo `e2e/auth.setup.ts` (timeout 30 s en el expect de workshop-name) y `playwright.config.ts` (timeout 60 s por test, expect 20 s). Las aserciones no cambian: siguen esperando el nombre del taller visible y fallarían si el login se rompiera (solo esperan más). Cambio mínimo.

Observación (sin fallo): el aviso Date.now() de `<WorkshopName />` en `next dev` persiste; ya anotado en la vuelta 1, no aparece en el build.
