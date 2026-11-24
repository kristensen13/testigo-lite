# Revisión T3 - vuelta 1

Resultado global: APROBADO

| Directriz / criterio | Resultado | Evidencia |
|---|---|---|
| 1 lint | Cumple | npm run lint sin salida de errores |
| 2 tsc | Cumple | npx tsc --noEmit sin errores |
| 3 build | Cumple | npm run build correcto |
| 4 any/ts-ignore | Cumple | sin ocurrencias en tests/rls |
| 8 migraciones | Cumple | git status/diff de supabase/ vacío (0001_init.sql intacto) |
| 9 npm test | Cumple | 3 tests Vitest en verde |
| 10 test:e2e | Cumple | 36 pasan (34 rls + 2 chromium previos) |
| 11 scripts | Cumple | test, test:e2e y test:rls en package.json |
| 12 / crit 1 anon | Cumple | anon.spec.ts: 8 tablas select (error o 0 filas) + insert con error + create_order denegado |
| 12 / crit 2 aislamiento | Cumple | aislamiento.spec.ts, ambos usuarios, cada tabla con workshop_id propio y >0 filas (no tautológico); 9999 ZZZ ausente |
| 12 / crit 3 insert ajeno | Cumple | aislamiento.spec.ts:62, código 42501 |
| 12 / crit 4 update ajeno | Cumple | aislamiento.spec.ts:75, 0 filas y comprobación desde taller 2 de que no cambió |
| 12 / crit 5 columnas | Cumple | lineas.spec.ts: 42501 + "permission denied" en insert aprobada, update decision y decided_at; control positivo description/qty_milli con decision intacta |
| 12 / crit 6 borrar orden | Cumple | lineas.spec.ts:70, la orden sigue existiendo |
| 12 / crit 7 create_order | Cumple | create-order.spec.ts: crea cliente, vehículo y orden en WS1; reutiliza vehículo con matrícula reescrita |
| 12 / crit 8 E2E únicas | Cumple | matriculaUnica() |
| 13/14 | Cumple | pruebas anteriores contra la BD real |
| 18 secretos / eyJ | Cumple | solo hash integrity en package-lock.json |
| 19 service_role | Cumple | solo en documentos .md y comentario de .env.example |
| 20 .env | Cumple | git ls-files filtrado vacío |
| 21 NEXT_PUBLIC | Cumple | solo URL y ANON_KEY |

Otros: sin console.* en tests; los mensajes de error no imprimen claves; las variables que faltan lanzan error (no se saltan); el seed no se altera (tests escriben solo filas E2E, y se comprueba que la orden demo del taller 2 sigue intacta).

Observaciones menores (no bloquean): el insert de anon usa {} y solo comprueba que hay error (no el código); el test de borrado admite error o 0 filas.
