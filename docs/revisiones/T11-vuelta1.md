# T11 vuelta 1 - APROBADO

Ejecutado: lint (0), tsc (0), npm test (16 ficheros, 206 tests), build (OK), test:e2e chromium en frío (38/38, incluidos los 5 de enlace-cliente). Sin next dev ajeno previo; puerto 3100 libre al terminar. Proyecto rls no ejecutado (a petición).

| Directriz | Resultado | Evidencia |
|---|---|---|
| 1-3 | Cumple | comandos anteriores |
| 4 | Cumple | sin any ni ts-ignore en los ficheros nuevos |
| 6 | Cumple | lógica en src/domain/public-link.ts |
| 7 | Cumple | orderId validado con z.uuid en src/lib/public-link.ts; intent comprobado contra los dos valores; host y proto con zod |
| 8 | Cumple | git status: ninguna migración ni PLAN/PROGRESS tocados |
| 9, 12 | Cumple | 20 tests de unidad; un test E2E por criterio 1-5 |
| 15 | Cumple | el token mostrado es el de la RPC (se exige ^[0-9a-f]{64}$), no se genera en la app |
| 17 | Cumple | E2E: portal_get devuelve datos antes de revocar/regenerar y null después |
| 18-21 | Cumple | greps vacíos (solo integrity de package-lock y prosa de docs); solo .env.example versionado; NEXT_PUBLIC solo URL y anon key |
| 22-26 | Cumple | botones min-h-11 con nombre accesible, :focus-visible global, aria-live en copiar, estado en texto, 360 px comprobado en E2E, uso con Enter |
| 27-29, 31 | Cumple | pending y errores con role=alert, textos en castellano, use client solo en enlace-acciones |
| 33 | Cumple | select expires_at, revoked_at, limit(1); nunca token_hash |

Observaciones (no son fallos)
- Host header injection: parseOrigin valida el host con regex estricta (sin rutas, credenciales ni espacios). Un atacante no puede fijar la cabecera Host de la petición de otro usuario; solo el propio usuario ve la URL y la Server Action tiene la comprobación de origen de Next. Riesgo aceptable. Mitigación opcional: lista blanca de hosts en producción.
- Criterio 3 pide "Revocado"; se muestra "Enlace revocado" y el test lo comprueba con /Enlace revocado/. Mismo significado.
- El token no sale en HTML tras recargar (E2E criterio 2), ni en la URL ni en logs; solo vive en el estado de useActionState del creador.
- Teléfono inválido: el enlace de WhatsApp se oculta y aparece un aviso (cubierto por la lógica de whatsappUrl; sin E2E propio).
- Los avisos de Date.now() en los logs del servidor dev aparecen también en rutas no tocadas por T11 (/, /ordenes/nueva); no bloquean.
- E2E: matrícula única E2E, no toca órdenes del seed ni cuenta órdenes; no imprime claves ni tokens.
