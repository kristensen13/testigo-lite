# T7 - vuelta 2

Resultado global: APROBADO

Comandos: lint (0 avisos), tsc (0), npm test (10 ficheros, 142 tests), build OK, `npm run test:e2e -- --project=chromium` en frío: 20/20 en verde. Sin `next dev` ajeno antes; puertos 3000-3002 libres al terminar.

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3 | Cumple | lint, tsc, build ejecutados |
| 9, 10 | Cumple | 142 tests; 20 E2E |
| 18-21 | Cumple | git grep de secretos y service_role sin coincidencias en código (solo docs y comentario de .env.example; eyJ solo hash de package-lock.json); solo .env.example versionado; NEXT_PUBLIC_* solo URL y anon key |

## Corrección
git diff: solo e2e/tablero.spec.ts (+4/-2): `goto("/?q=1234abc")` y tope de Tab 15. Siguen las comprobaciones de href, llegada con Tab, outline y Enter. No debilita el test.

## Observaciones
- Fragilidad: los tests "criterio 1", "criterio 6" y el de 360 px buscan órdenes del seed sin `?q=`; con el límite de 300 órdenes por created_at desc, tras ~290 órdenes E2E acumuladas dejarían de verlas. Hoy pasan en verde, no incumple directriz; limitación futura recuperable con supabase/seed.sql.
- Aviso Date.now() de prerender en el log de dev: ya evaluado en T5/T6, no afecta al resultado.
