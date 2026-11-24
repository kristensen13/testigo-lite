# Testigo Lite

Versión mínima y bien acabada de Testigo para talleres de mecánica. El taller da de alta la orden de reparación, arma el presupuesto y comparte un enlace con el cliente. El cliente, sin instalar nada ni iniciar sesión, ve en qué estado está su coche y aprueba o rechaza cada trabajo. La decisión queda guardada con su fecha y el taller la ve al momento.

Este documento define el producto. Las tareas están en `PLAN.md`, las normas de calidad en `DIRECTRICES.md`.

## Usuarios

- **Recepción / dueño del taller.** Ordenador o tablet en el mostrador. Da de alta órdenes, arma presupuestos, cambia estados, envía enlaces y vigila el tablero. Cada usuario pertenece a un único taller.
- **Cliente (conductor).** Recibe un enlace por WhatsApp y lo abre en el móvil, a menudo con prisa y sin ganas de llamar. Muchos son mayores. Quiere saber cómo va su coche, cuánto le costará y decidir sin llamar.
- No hay rol de mecánico en esta versión.

## Alcance

**Incluye**

- Login del taller con email y contraseña (Supabase Auth). Cada usuario pertenece a un taller.
- Tablero de órdenes por estado, con buscador por matrícula o por cliente.
- Nueva orden: cliente (nombre, teléfono), vehículo (matrícula, marca/modelo, km) y avería que cuenta el cliente.
- Ficha de la orden: trabajos del presupuesto, totales, cambio de estado e historial.
- Botón "Enlace para el cliente": crea `/p/<token>` y lo comparte por WhatsApp (`wa.me` con texto).
- Portal del cliente sin login: estado del coche, presupuesto y aprobación o rechazo de cada trabajo con confirmación.
- Aviso en vivo al taller cuando el cliente decide.
- Datos demo y dos usuarios demo.

**No incluye (fuera de alcance)**

Fotos o vídeos, pagos online, citas, inventario, roles distintos, gestión de varios usuarios por taller desde la interfaz, factura electrónica, IA, notificaciones push y multidioma. La interfaz es solo en castellano.

## Flujo principal

1. Recepción inicia sesión y crea una orden con cliente, vehículo y avería. La orden nace en **Recibido**.
2. Recepción la mueve a **Diagnóstico** y añade al presupuesto los trabajos (mano de obra o recambio).
3. Pasa la orden a **Esperando aprobación** y pulsa "Enlace para el cliente". Comparte el enlace por WhatsApp.
4. El cliente abre `/p/<token>`, ve el estado y el presupuesto, y aprueba o rechaza cada trabajo confirmando.
5. El taller ve la decisión al momento: aviso en pantalla, chip en el tablero, decisión con fecha en la ficha y evento en el historial.
6. Recepción sigue el trabajo hasta **Entregado**.

## Dominio

### Estados de la orden

| Estado (taller) | Nombre para el cliente |
|---|---|
| Recibido | Recibido |
| Diagnóstico | En diagnóstico |
| Esperando aprobación | Necesitamos tu OK |
| En reparación | En reparación |
| Listo | Listo para recoger |
| Entregado | Entregado |

Transiciones: solo al estado siguiente o al anterior. **Entregado** es terminal. Las reglas viven en `src/domain`. Las decisiones del cliente **no** cambian el estado solas; lo cambia el taller.

### Línea del presupuesto

- Tipo: **mano de obra** o **recambio**.
- Descripción, cantidad, precio unitario sin IVA e IVA fijo del **21 %**.
- Decisión del cliente: `pendiente` · `aprobada` · `rechazada`, con fecha (`decided_at`).
- Una línea decidida es definitiva: ni el taller ni el cliente pueden cambiarla.
- Solo se puede decidir mientras la orden está en **Esperando aprobación**.

### Importes

- Todo en **céntimos enteros**; nunca decimales en coma flotante. La cantidad se guarda en milésimas (1,5 h = 1500).
- Base por línea = cantidad × precio, redondeada al céntimo (half-up). IVA = 21 % sobre la suma de bases, redondeado. Total = base + IVA.
- Se muestran dos totales: el **total del presupuesto** (todas las líneas) y el **total aprobado** (solo las líneas aprobadas).
- El servidor calcula los importes; el cliente nunca envía precios ni totales.

## Portal del cliente

- **Acceso:** por `/p/<token>`, sin login. El token son 32 bytes aleatorios en hexadecimal (64 caracteres). En la base de datos solo se guarda su hash (SHA-256).
- **Vida del enlace:** caduca a los 7 días por defecto y se puede revocar. Un enlace nuevo revoca el anterior. El taller solo ve el enlace completo justo después de crearlo.
- **Lista blanca de datos:** nombre y teléfono del taller, matrícula, marca/modelo, estado, líneas (descripción, tipo, cantidad, precio, decisión y fecha), totales y fecha de caducidad.
- **Nunca se muestra:** teléfono ni nombre completo del cliente, km, historial interno, ids internos ni datos de otros talleres. Única excepción: el identificador (uuid) de cada línea del presupuesto que se puede decidir, que `portal_get` ya devuelve en su lista blanca y que `portal_decide` necesita; solo viaja en el payload de la página (no como atributo visible), no sirve sin un token válido y no se filtra ningún id de orden, taller, cliente ni vehículo.
- **Enlace inexistente, caducado o revocado:** la misma página genérica "Este enlace ya no está disponible", sin pistas del motivo.
- **Decidir:** cada trabajo pendiente tiene "Aprobar" y "Rechazar", y pide confirmación explícita con el nombre del trabajo y el importe ("¿Apruebas «Pastillas de freno» por 88,94 €?"). Con "Volver" no se guarda nada.
- **Cabeceras:** `/p/*` va con `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` y sin caché.

## Seguridad y restricciones técnicas

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres + Auth) con `@supabase/ssr`, zod, despliegue en Vercel. En Next 16 el antiguo `middleware` se llama **proxy** (`src/proxy.ts`).
- **Aislamiento por taller:** RLS en todas las tablas, con políticas por `workshop_id`. Un taller no ve ni modifica datos de otro. Se prueba con un segundo taller y un segundo usuario.
- **Sin `service_role`** en ningún sitio. El acceso anónimo del portal es solo por funciones RPC `security definer` con lista blanca; ninguna tabla es legible por `anon`.
- **Decisiones a prueba de manipulación:** solo la función del portal escribe `decision` y `decided_at`. El historial lo escriben triggers y funciones del sistema, no los clientes.
- **Variables:** `NEXT_PUBLIC_*` solo para la URL y la clave anónima de Supabase. Los secretos viven en `.env.local` (ignorado por git) y en las variables de entorno de Vercel. Nadie lee ni muestra `.env*`.
- **Validación:** toda entrada de Server Actions y route handlers se valida con zod en el servidor.
- **Migraciones:** `supabase/migrations/0001_init.sql`, `0002_portal.sql`, `0003_…`. Nunca se edita una migración ya aplicada. Se aplican a mano en el SQL Editor de Supabase (no hay Supabase CLI).
- **Aviso en vivo:** Supabase Realtime (`postgres_changes`) sobre las líneas y el historial; las políticas de lectura por taller filtran lo que recibe cada usuario.

## Dirección visual

Versión reducida de la referencia, pensada para leerse de un vistazo desde el móvil.

- **Portal:** una sola columna de 42 rem como máximo. Arriba, un panel oscuro con la matrícula, el modelo y el estado en grande; debajo, el trabajo sobre un gris claro en tarjetas blancas. El nombre del taller manda; "Testigo" solo aparece discreto en el pie.
- **Color:** tinta casi negra y gris frío como base. Un único acento amarillo, escaso, solo para "requiere tu atención" (estado iluminado, aviso de decisión pendiente, foco sobre fondo oscuro). Nunca en botones ni enlaces. Verde solo para dinero que el cliente no paga (no se usa en esta versión). Óxido para urgencia y errores.
- **Acción:** botones de tinta negra sólida, de 48–50 px de alto en el portal. Lo pulsable es lo que más pesa.
- **Tipografía:** rótulo condensado (Barlow Semi Condensed, cargada con `next/font`) para estados, títulos, cifras y matrículas; fuente del sistema para los textos que se leen. Cifras tabulares en importes y matrículas.
- **Estados con forma, no solo color:** icono + texto + forma (relleno, contorno, discontinuo) en estados y decisiones.
- **Taller:** más denso, pensado para ordenador y tablet, con el mismo lenguaje visual (tinta, gris, un acento) y el tablero como pantalla principal.
- **Movimiento:** mínimo y breve; se respeta `prefers-reduced-motion`.

## Accesibilidad e inclusión

- WCAG 2.2 AA como mínimo; contraste 4,5:1 en texto normal.
- Texto de lectura ≥ 16 px y zoom permitido; objetivos táctiles ≥ 44 px (≥ 48 px en el portal).
- Todo se usa con teclado, con foco visible y orden lógico. Todos los campos tienen `<label>`.
- Móvil primero: usable a 360 px sin scroll horizontal.
- El estado nunca depende solo del color. Los avisos en vivo usan una región `aria-live`.
- Lenguaje de conductor, no de taller: sin jerga ni códigos internos en el portal.

## Datos demo y entorno de pruebas

- **Dos talleres y dos usuarios.** El taller 1 tiene unas diez órdenes ficticias repartidas por los seis estados (con clientes, matrículas y teléfonos inventados). El taller 2 tiene un par de órdenes propias para comprobar que no se mezclan datos.
- **Usuarios:** se crean a mano en Supabase (Auth → Users). `supabase/seed.sql` los enlaza a su taller por email y se puede volver a ejecutar para restablecer los datos demo.
- **Variables para Playwright** (en `.env.local`, que Playwright carga; ningún agente lo lee): `E2E_EMAIL` y `E2E_PASSWORD` (usuario del taller 1), `E2E_EMAIL_2` y `E2E_PASSWORD_2` (usuario del taller 2), además de `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Datos de los tests:** los E2E crean órdenes con matrícula única prefijada `E2E`. No se borran (no hay `service_role` ni política de borrado de órdenes); `seed.sql` deja la base limpia.
- **Pruebas:** Vitest para la lógica de `src/domain`; Playwright arranca la app con `npm run dev` y cubre los flujos y las pruebas de RLS contra la BD real.

## Principios de producto

1. El estado y lo que el cliente debe decidir van primero; lo demás es secundario.
2. Lenguaje de conductor: claro, corto, sin jerga.
3. Transparencia demostrable: precio cerrado, decisión confirmada y registrada con fecha.
4. Privacidad por defecto: se muestra el mínimo necesario.
5. Rápido y ligero en cualquier móvil.
6. Pocas cosas, bien acabadas: preferimos menos funciones y todas con estados de carga, error y vacío.
