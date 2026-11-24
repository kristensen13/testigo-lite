# Revisión T9 - vuelta 1

Resultado global: APROBADO

Comandos ejecutados: lint (0 avisos), `npx tsc --noEmit` (0 errores), `npm test` (14 ficheros, 187 tests en verde), `npm run build` (OK), `npm run test:e2e -- --project=chromium` (33/33), `npx playwright test tests/rls/lineas-decididas.spec.ts --project=rls` (1/1). No había `next dev` ajeno; tras las pruebas no queda ningún listener en 3000-3002 (solo sockets TIME_WAIT).

| Directriz / criterio | Resultado | Evidencia |
|---|---|---|
| 1, 2, 3 | Cumple | lint, tsc y build limpios |
| 4 | Cumple | grep sin any, ts-ignore ni eslint-disable en los ficheros de T9 |
| 5, 6 | Cumple | order-lines.ts reutiliza money.ts (parseEurosToCents, parseQuantityToMilli, formatCents) y totals.ts (lineBaseCents, orderTotals); sin cálculos duplicados ni coma flotante. Cálculo a mano: 8000 + 2550 = 10550 base; IVA 2215,5 con half-up 2216; total 12766 (105,50 / 22,16 / 127,66). Verificado en E2E |
| 7 | Cumple | uuid y campos validados con zod y parsers; toLineValues lee solo kind, description, qty y price; el insert no envía decision, decided_at ni vat_bp; workshop_id sale de la orden leída en servidor; sin service_role |
| 8 | Cumple | git status: ninguna migración tocada |
| 9 | Cumple | order-lines.test.ts (dominio) y lib/order-lines.test.ts en verde |
| 10, 12 | Cumple | e2e/presupuesto.spec.ts cubre los criterios 1 a 4; el criterio 5 lo cubren los tests de createLine, que ignoran importes y totales del cliente |
| 13-21 | Cumple | git grep de secretos vacío; `eyJ` solo en el integrity de package-lock; service_role solo en prosa de documentos y .env.example; solo .env.example versionado |
| Crit. 4 | Cumple | update y delete filtran por id, order_id y decision='pendiente' y exigen 1 fila afectada; el spec de BD pasa de verdad (compara los datos antes y después); la línea decidida se muestra sin botones (E2E sobre la orden 8642) |
| Crit. 2 | Cumple | errores con role=alert, aria-invalid y aria-describedby junto al campo; el valor escrito se conserva (E2E, 6 casos) |
| 22, 24-26 | Cumple | labels asociados; :focus-visible global; min-h-11; E2E de 360 px sin scroll horizontal; botones con aria-label; decisión dicha con texto |
| 27-31, 33 | Cumple | estado vacío con mensaje útil, textos en castellano, "use client" solo en linea-forms.tsx, una única consulta de líneas con columnas explícitas |
| Hueco T11 | Cumple | data-slot="presupuesto-y-enlace" se conserva y contiene Presupuesto; queda sitio para T11 |

## Observaciones (no son fallos)

- Rechazar el precio 0: la BD lo permitiría (unit_price_cents >= 0), pero el criterio 2 dice "cero, negativo...". Rechazarlo es coherente con el criterio literal.
- Los E2E con servidor en frío muestran en stderr de WebServer avisos "Date.now() while prerendering" en `(taller)/layout.tsx:23`. Es código anterior a T9 y no hace fallar ningún test.
- Los E2E no modifican las líneas ni el estado del seed. Crean una orden E2E nueva, igual que en T7.
