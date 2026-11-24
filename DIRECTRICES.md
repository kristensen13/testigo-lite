# Directrices

Normas que **develop** debe cumplir y que **testing** hace cumplir. Cada punto es comprobable; testing los verifica ejecutando los comandos, no leyendo por encima.

## Calidad

1. `npm run lint` termina sin errores ni warnings.
2. `npx tsc --noEmit` termina sin errores.
3. `npm run build` termina correctamente.
4. No hay `any` injustificado, ni `@ts-ignore`/`eslint-disable` sin comentario que lo explique.
5. Dinero siempre en céntimos (enteros); sin decimales en coma flotante.
6. La lógica de negocio vive en `src/domain` (pura, sin Next ni Supabase).
7. Toda entrada de Server Actions y de route handlers se valida con zod en el servidor.
8. Los cambios de BD son migraciones nuevas en `supabase/migrations/`; ninguna migración existente fue modificada (`git diff` lo confirma).

## Tests

9. `npm test` (Vitest) pasa en verde y cubre la lógica de `src/domain` añadida o modificada.
10. `npm run test:e2e` (Playwright) pasa en verde y cubre los flujos clave de la tarea.
11. Los scripts `test` y `test:e2e` existen en `package.json`.
12. Cada criterio de aceptación de la tarea tiene al menos un test que lo comprueba.

## Seguridad

13. RLS activado en **todas** las tablas del esquema público (`alter table ... enable row level security`) y con políticas explícitas.
14. Un taller no puede ver ni modificar datos de otro taller (políticas por propietario, probado con un test).
15. El enlace del cliente usa un token aleatorio largo (≥ 128 bits de un generador criptográfico), no un id secuencial ni predecible.
16. La vista pública del cliente devuelve solo los campos necesarios, nunca filas completas.
17. El enlace del cliente puede caducar y revocarse, y un enlace caducado o revocado no da acceso (probado con un test).
18. Ninguna clave ni secreto en el código: `git grep -nEi "(secret|api[_-]?key|password|token)\s*[:=]\s*['\"][^'\"]{8,}"` y `git grep -n "eyJ"` sin coincidencias reales.
19. No se usa `service_role` en ningún sitio (`git grep -ni service_role` vacío).
20. Ningún `.env*` está versionado salvo `.env.example` (`git ls-files | grep -i "^\.env" | grep -v "^\.env\.example$"` vacío), `.env.example` no contiene valores (solo nombres de variables con el valor vacío) y no se ha leído ni mostrado `.env.local`.
21. Las variables expuestas al navegador (`NEXT_PUBLIC_*`) son solo la URL y la clave anónima de Supabase.

## Accesibilidad

22. Todos los campos de formulario tienen `<label>` asociado.
23. Contraste de texto suficiente (WCAG AA: 4.5:1 en texto normal).
24. Todo se puede usar solo con teclado: orden de foco lógico, foco visible, sin trampas de foco.
25. Diseño móvil primero: usable en 360 px de ancho, sin scroll horizontal.
26. Imágenes con `alt`; botones e iconos sin texto con nombre accesible.

## UX

27. Estados de carga (`loading.tsx` o equivalentes) y de error (`error.tsx`, mensajes en formularios) en cada pantalla con datos o mutaciones.
28. Estados vacíos con mensaje útil.
29. Todos los textos visibles al usuario están en castellano, incluidos los mensajes de error.
30. Los formularios muestran los errores de validación junto al campo y no pierden lo escrito.

## Rendimiento básico

31. Server Components por defecto; `"use client"` solo donde hace falta y en componentes pequeños.
32. Imágenes con `next/image` y dimensiones; sin dependencias pesadas innecesarias.
33. Consultas a Supabase seleccionan solo las columnas necesarias, sin consultas en bucle (N+1).
34. Las tablas consultadas por filtro o por token tienen índice.
