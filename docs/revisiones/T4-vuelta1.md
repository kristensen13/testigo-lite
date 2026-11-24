# Revisión T4, vuelta 1

**Resultado global: APROBADO**

Comandos ejecutados: lint (0 avisos), `npx tsc --noEmit` (0), `npm test` (6 ficheros, 106 tests en verde), `npm run build` (OK), `npm run test:e2e -- --project=chromium` (2/2), greps de seguridad (sin coincidencias reales; el único `eyJ` es un hash de integrity en package-lock.json; `service_role` solo en docs/comentarios).

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1, 2, 3 | Cumple | lint, tsc y build con código 0 |
| 4 | Cumple | grep: sin any, ts-ignore ni eslint-disable en src/domain |
| 5 | Cumple | Parseo por cadena con regex; los únicos `Number()` son sobre dígitos (<= 9) o BigInt ya redondeado; sin parseFloat; Math.abs solo en índices; redondeo con BigInt |
| 6 | Cumple | Sin imports de next ni supabase en los 6 ficheros |
| 8 | Cumple | git diff vacío; supabase/ y PLAN.md sin cambios |
| 9, 11, 12 | Cumple | Criterios 1-5 cubiertos (ver abajo) |
| 10 | Cumple | E2E chromium en verde |
| 18, 19, 20 | Cumple | greps vacíos |

## Criterios T4
1. 3 x 1,5 x 45,50 = 20475 (4500*4550/1000), IVA 4299,75 -> 4300, total 24775; verificado a mano. Redondeo .5 en línea (500*1 -> 1) y en IVA (105,50*0,21 = 22,155 -> 22,16).
2. Test de orden vacía: todo 0, incluido aprobado.
3. Tabla 6x6 completa generada; coincide con orders_guard (abs(diff)=1, entregado terminal) y con el check de estados.
4. Test 0,10 + 0,20 = 30 céntimos.
5. Entradas inválidas de parse*, normalizePhone y whatsappUrl devuelven {ok:false,error} en castellano.

## Coherencia con la BD
- ORDER_STATUSES igual y en el mismo orden que el check y v_states.
- normalizePlate equivale a normalize_plate (`[\s-]+` y mayúsculas). Diferencia teórica: `\s` de JS incluye algún espacio Unicode más; irrelevante en la práctica.
- Total aprobado suma solo `decision === "aprobada"`.
- formatCents es un alias de formatEuros (sin duplicar).

## Observaciones (no bloqueantes)
- lineBaseCents/orderTotals lanzan RangeError con enteros no seguros o fuera de rango. Solo puede ocurrir por error de programación: la BD usa enteros con check y los parse limitan a 9 dígitos. Aceptable. Lo mismo para formatEuros (preexistente de T2).
- lineBaseCents no valida negativos (la BD lo impide con checks).
