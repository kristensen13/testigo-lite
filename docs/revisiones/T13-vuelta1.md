# T13 - vuelta 1 - Resultado: APROBADO

Comandos ejecutados: npm run lint (0), npx tsc --noEmit (0), npm test (20 ficheros, 255 tests), npm run build (OK),
npm run test:e2e -- --project=chromium (50/50, incluye los 5 tests de decision.spec.ts). No se ejecuto el proyecto rls.
Sin next dev ajeno al empezar; puertos 3000/3100 libres al terminar.

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3 | Cumple | lint, tsc y build sin errores |
| 4 | Cumple | git grep de any/ts-ignore/eslint-disable vacio |
| 5-6 | Cumple | importes en centimos con BigInt (src/domain/portal-decision.ts); logica en domain |
| 7 | Cumple | decideInputSchema strictObject (token 64 hex, uuid, enum); respuesta RPC validada con zod; cliente anonimo createPortalClient; solo p_token/p_line_id/p_decision |
| 8 | Cumple | git diff sin cambios en supabase/ ni en PLAN/PRODUCT/DIRECTRICES |
| 9-12 | Cumple | tests unitarios nuevos y E2E por criterio 1-7 |
| 15-17, 19 | Cumple | RPC existente; service_role solo en prosa/comentarios |
| 18, 20, 21 | Cumple | greps sin coincidencias reales; solo .env.example versionado y sin valores |
| 22-26 | Cumple | aria-label con el trabajo, min-h-12, foco al confirmar y vuelta al origen (E2E), 360 px sin scroll (E2E), iconos con texto |
| 27-29 | Cumple | Guardando..., errores en castellano con role=alert, estado vacio |
| 31 | Cumple | "use client" solo en decision-actions.tsx |
| 33 | Cumple | order_lines(description) embebido en la misma consulta, sin N+1 |

## Criterios 1-7: todos comprobados en e2e/decision.spec.ts
Chip "Cliente: 2/3 decididos" se comprueba con tres lineas; la cuarta (D) se anade despues, en el test del criterio 7.

## Observaciones (no son fallos)
1. Importe por linea con IVA (A 96,80 + B 30,86 + C 12,10 = 139,76) coincide con el total aqui, pero en general la suma de importes por linea puede diferir 1 centimo del total del presupuesto (IVA sobre la suma de bases). Confirmacion dice "IVA incluido". Riesgo menor.
2. Privacidad: el uuid de la linea pendiente viaja en el payload RSC (prop de DecisionActions), no como atributo visible del DOM. Es necesario para portal_decide, inutil sin token valido y viene de la lista blanca de portal_get. Aceptable; no se filtran ids de orden/taller/cliente/vehiculo ni telefono/km/averia. Recomendable anotarlo en PRODUCT.md ("ids internos": excepcion el id de linea pendiente).
3. Avisos de Date.now() en el servidor dev (layout del taller) preexistentes, no de T13.
