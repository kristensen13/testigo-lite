# T10 - vuelta 3 (fase de ejecución contra la BD real)

Resultado global: APROBADO.

## Resultados
- npm run lint: sin errores ni warnings.
- npx tsc --noEmit: sin errores.
- npm test: 14 ficheros, 187 tests en verde.
- npm run build: correcto.
- npx playwright test tests/rls/portal.spec.ts --project=rls: 21/21 en verde (26,5 s).
- npx playwright test --project=rls (completo): 57/57 en verde (13,6 s). Los specs anteriores (anon, aislamiento, create-order, lineas, cambio-estado) siguen en verde tras la migración. No hubo rate limit.
- git diff --stat 27ce829 -- supabase: vacío (0001 y 0002 sin cambios). git status limpio.

## Criterios 2-7 contra la BD real
- Token aleatorio y formatos inválidos: nada (tests 1-2).
- Lista exacta de claves de la lista blanca (test 3); también con sesión de usuario (test 4).
- TTL 0: portal_get null y portal_decide falla (test 5). Revocado (test 6). Crear nuevo revoca el anterior (test 7).
- Un solo enlace activo: dos creaciones seguidas (8), TTL 0 seguidos (9), concurrentes (10).
- ttl fuera de 0..90 rechazado (11).
- portal_decide: decide y deja evento de cliente (12); falla fuera de esperando_aprobacion (13), línea ajena (14), inexistente (15), ya decidida (16), decisión inválida/token aleatorio (17).
- Taller 2 no crea ni revoca enlaces del taller 1 (18); orden inexistente = mismo error que ajena (19).
- insert/update/delete directos en public_links denegados, y las funciones sí funcionan (20). anon sin acceso a funciones de taller ni a la tabla (21).

## Concurrencia
El test concurrente pasa. El test no imprime el número de tokens devueltos y no puedo editar tests, así que no pude observarlo directamente. El test sigue aceptando tokens.length >= 1 (portal.spec.ts:267 y :273). Sigue pendiente la sugerencia de endurecerlo a tokens.length === 2 (y quitar el patrón de errores tolerados en :267) para detectar la pérdida del bloqueo de la función. No es bloqueante.

## Seguridad
- git grep de secretos: sin coincidencias. git grep "eyJ": solo texto de documentos. service_role: solo documentos, agentes y comentario de .env.example, nunca en código ni en 0002. Solo .env.example versionado. No se leyó .env.local.
- No se dejó ningún servidor activo (solo sockets TIME_WAIT del puerto 3000 de la ejecución previa).

## Directrices
1-3, 4, 8, 9, 11, 12, 13-17, 18-21, 34: cumple.
