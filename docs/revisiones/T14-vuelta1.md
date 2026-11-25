# T14 - vuelta 1 - APROBADO

Ejecutado: lint (0 avisos), tsc (0), npm test (21 ficheros, 267 tests), npm run build OK, npm run test:e2e -- --project=chromium: 57/57 en 1,8 min (una sola ejecución, sin fallos ni reintentos; no se observó inestabilidad). No había `next dev` ajeno; el servidor que arrancó Playwright se cerró solo y no quedan puertos 3xxx en escucha.
Seguridad: git grep de secretos y eyJ sin coincidencias reales (solo integrity de package-lock y prosa); service_role solo en documentos/agentes y en un comentario de .env.example; solo .env.example versionado y sin valores; no se leyó .env.local. git status: solo layout (3 líneas) + 4 ficheros nuevos; ninguna migración ni documento del plan tocado.

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3, 8-12 | Cumple | comandos arriba; cada criterio 1-6 tiene test en e2e/en-vivo.spec.ts |
| 4 | Cumple | sin any ni ts-ignore |
| 6 | Cumple | interpretChange/pushNotice puros en src/domain/live-updates.ts + test |
| 18-21 | Cumple | ver arriba; NEXT_PUBLIC_* solo URL y anon (test criterio 6) |
| 22-26 | Cumple | role=status + aria-live=polite, botón "Cerrar aviso" min 44 px con aria-label, sin robar foco, cierre con Enter/Espacio probado |
| 29 | Cumple | textos en castellano |
| 31 | Cumple | "use client" solo en el componente pequeño; layout sigue siendo Server Component |
| 33 | Cumple | no hay consultas nuevas (solo router.refresh) |

## Valoración (a): requisito type='decision'
- Los eventos enlace_creado/enlace_revocado nunca generan aviso ni refresco: interpretChange solo acepta order_events INSERT con type==='decision' (y ese no avisa, solo refresca). El aviso sale de order_lines UPDATE con decision aprobada/rechazada, que solo puede producirla portal_decide (0002 l.341): el taller no puede actualizar líneas decididas ni escribir decision (0001, privilegios de columna y política update con decision='pendiente'). Equivale semánticamente a "solo decisiones del cliente".
- La limitación del filtro de servidor es plausible (anon sin SELECT en order_events por 0001 l.203) y la alternativa (conceder SELECT a anon) sería un agujero; filtrar en cliente es razonable. Filtrar order_lines por decision tampoco es posible con filtro de servidor (mismo mecanismo y solo eq).
- Exposición: create/revoke_public_link insertan en order_events solo (order_id, workshop_id, type, actor); no hay token, hash ni nota. Llegan solo al mismo taller por RLS (probado: el usuario del taller 2 no recibe nada; control positivo con joins aceptados).
- Los tests pueden fallar: unit (enlace_* -> sin refresh ni aviso) y E2E (señal positiva de que los frames enlace_* sí llegan y contador MutationObserver de avisos = 0).
- Recomendación: dejar constancia en PRODUCT.md/PLAN.md (T14) de que el filtro es de cliente y de que el aviso nace de order_lines UPDATE.

## (b) 5 s
Medir desde que el portal muestra la decisión (BD ya escrita) es válido: excluye la compilación de la acción en dev, no la latencia de Realtime. Test estable en esta ejecución; se aceptan margen de 15 s de espera y aserción final < 5000 ms.

## (e) Ciclo de vida
setAuth() antes de crear el canal, nombre único por montaje, cancelled + removeChannel en cleanup, timers limpiados; montaje en el layout (persiste entre tablero y ficha): E2E criterio 5 comprueba un canal vivo y sin altas nuevas tras 4 navegaciones. Fallo de canal: solo console.warn en dev, sin error visible.

## Observaciones menores (no bloquean)
- El dev server imprime "unstable value Date.now()" en TallerLayout: preexistente (documentado en revisiones anteriores), el build no lo produce.
