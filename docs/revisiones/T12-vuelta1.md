# T12 vuelta 1 - Portal del cliente (lectura)

Resultado global: APROBADO.

Comandos ejecutados: npm run lint (0 avisos), npx tsc --noEmit (0), npm test (18 ficheros, 235 tests en verde), npm run build (OK, /p/[token] PPR), npm run test:e2e -- --project=chromium (44/44, incluye portal.spec.ts). No se ejecuto el proyecto rls. Antes de empezar no habia ningun servidor en puertos 3xxx.

| Directriz / criterio | Resultado | Evidencia |
|---|---|---|
| 1-3 calidad | Cumple | lint, tsc y build ejecutados |
| 5 dinero | Cumple | totales con orderTotals y formatEuros desde centimos; formatQuantity solo con enteros; test 105,50 / 22,16 / 127,66, aprobado 30,86 en portal.test.ts |
| 6 dominio puro | Cumple | src/domain/portal.ts sin Next ni Supabase |
| 8 migraciones | Cumple | git diff vacio; sin ficheros tracked modificados |
| 9-12 tests | Cumple | vitest + e2e verdes; cada criterio 1-5 tiene test |
| 16 lista blanca | Cumple | zod strictObject en todos los niveles, clave extra -> null (test); HTML (res.text y page.content) sin telefono, nombre, km ni id de orden (e2e criterio 2); solo una RPC portal_get |
| 17 / criterio 3 | Cumple | curl con token inventado, mayusculas y malformado: 200 en todos, mismas cabeceras, mismo titulo, mismo cuerpo salvo el eco del token en la URL; e2e compara estado, titulo y texto de inventado/revocado/caducado/malformado |
| 18-21 secretos | Cumple | git grep sin coincidencias reales; service_role solo en prosa/docs; solo .env.example versionado; NEXT_PUBLIC solo URL y anon key; no se leyo .env.local |
| cliente BD | Cumple | src/lib/portal.ts: createClient con anon key, sin sesion ni cookies, sin service_role |
| cabeceras | Cumple | curl: Referrer-Policy no-referrer, X-Robots-Tag noindex, nofollow, Cache-Control no-store; meta robots noindex |
| 22-26 accesibilidad | Cumple | e2e a 360 px: sin scroll horizontal, todo texto >= 16 px, contraste >= 4.5 medido; boton tel >= 48 px; viewport sin bloqueo de zoom; estados con texto e icono distinto; aria-current="step"; h1 sr-only + h2; lang="es". Pares: muted #4b5563 sobre blanco ~7,5; line #d3d8df sobre ink ~11; ink sobre accent #f5c518 ~11 |
| 27-29 UX | Cumple | loading.tsx, error.tsx (retry segun docs de Next 16.4), pagina vacia de trabajos; todo en castellano |
| 31 | Cumple | solo error.tsx es "use client" |
| 33 | Cumple | una sola RPC |
| criterio 5 | Cumple | e2e: etiquetas Recibido / En diagnostico / Necesitamos tu OK y 0 botones Aprobar/Rechazar |
| E2E | Cumple | contexto sin sesion a 360 px, una orden E2E, sin tocar seed, el login REST no imprime credenciales ni tokens |

Observaciones (no son fallos)
- El proxy llama a getUser en /p/*: es inocuo para el cuerpo (el portal no usa cookies y la respuesta es identica con o sin sesion); solo anade latencia y podria emitir Set-Cookie si el navegador tiene sesion de taller.
- Un token malformado no llama a la BD y por eso responde mas rapido que uno bien formado; solo revela la forma del token, no su validez.
- Avisos Date.now() del WebServer en el layout del taller son anteriores a T12.
- Servidor propio en 3199 parado; puertos 3100 y 3199 libres.
