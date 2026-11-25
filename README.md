# Testigo Lite

Aplicación Next.js 16 (App Router) + TypeScript + Tailwind 4, con Supabase (Postgres + Auth), desplegada en Vercel. La definición del producto está en `PRODUCT.md`.

## Requisitos

- Node.js 22.12 o superior (con npm) y Git.
- Una cuenta gratuita de [Supabase](https://supabase.com) (base de datos Postgres + Auth + Realtime).
- Para desplegar: una cuenta de [Vercel](https://vercel.com) y el repositorio en GitHub, GitLab o Bitbucket.
- Para los tests E2E: Chromium de Playwright (`npx playwright install chromium`).

## Puesta en marcha (en local)

### 1. Instalar

```bash
git clone <url-del-repositorio>
cd testigo-lite
npm install
```

### 2. Crear el proyecto en Supabase

1. En Supabase: **New project** (elige región y una contraseña de base de datos; no hace falta para la app).
2. Espera a que termine de crearse. Los valores que necesitarás después están en **Project Settings → API**.

### 3. Aplicar el esquema y los datos demo (a mano, en el SQL Editor)

Abre **SQL Editor → New query**, pega el contenido de cada archivo y pulsa **Run**, **en este orden**:

1. `supabase/migrations/0001_init.sql`: tablas, restricciones, índices y políticas RLS.
2. `supabase/migrations/0002_portal.sql`: funciones del portal del cliente (`create_public_link`, `revoke_public_link`, `portal_get`, `portal_decide`) y publicación Realtime. Si en el futuro hay más migraciones (`0003_...`), se aplican igual, en orden numérico.
3. Crea antes de la semilla los dos usuarios demo (paso siguiente) y después ejecuta `supabase/seed.sql`.

Las migraciones no se editan una vez aplicadas: cualquier cambio de esquema es una migración nueva.

### 4. Crear los dos usuarios demo

En **Authentication → Users → Add user → Create new user**, crea dos usuarios con email y contraseña y marca **Auto Confirm User** (así no hace falta confirmar por correo). Uno será el usuario del taller 1 y el otro el del taller 2 (sirve para comprobar que un taller no ve los datos del otro).

Después abre `supabase/seed.sql` y, al principio, cambia los dos emails de ejemplo por los de tus usuarios:

```sql
v_email_1 constant text := 'demo@example.com';    -- usuario del taller 1
v_email_2 constant text := 'demo2@example.com';   -- usuario del taller 2
```

Pega el archivo en el SQL Editor y ejecútalo. El seed es **re-ejecutable**: cada vez borra y recrea los dos talleres demo y todo lo que cuelga de ellos, así que también **limpia las órdenes `E2E…` que dejan los tests**. Crea 14 órdenes demo (12 en el taller 1 y 2 en el taller 2); dos de las del taller 1 están entregadas hace unos 45 y 90 días y solo se ven con «Ver entregadas anteriores».

### 5. Variables de entorno

Copia la plantilla y rellénala (el archivo `.env.local` está en `.gitignore`; no lo subas nunca):

```bash
cp .env.example .env.local
```

| Variable | Para qué sirve | De dónde sale |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto de Supabase | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anónima) con la que la app habla con Supabase | Project Settings → API → clave `anon` / `public` |
| `E2E_EMAIL`, `E2E_PASSWORD` | Usuario del taller 1, para los tests E2E | Los del primer usuario demo |
| `E2E_EMAIL_2`, `E2E_PASSWORD_2` | Usuario del taller 2, para los tests de aislamiento | Los del segundo usuario demo |

- La aplicación **solo usa la clave anónima**. La seguridad la ponen las políticas RLS y las funciones de la base de datos. **No pongas la clave `service_role` en ningún sitio** (ni en `.env.local`, ni en Vercel, ni en el código).
- Las cuatro variables `E2E_*` solo se usan en los tests locales. No se configuran en Vercel.

### 6. Arrancar

```bash
npm run dev
```

Abre <http://localhost:3000> e inicia sesión con uno de los usuarios demo.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación de producción |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Comprobación de tipos |
| `npm test` | Tests unitarios (Vitest) de la lógica de `src/domain` y de `src/lib` |
| `npm run test:e2e` | Todos los tests de Playwright (proyectos `setup`, `chromium` y `rls`) |
| `npm run test:rls` | Solo el proyecto `rls` (no abre navegador ni la app) |

Proyectos de Playwright (`playwright.config.ts`):

- `setup`: inicia sesión una sola vez con `E2E_EMAIL` y guarda la sesión en `e2e/.auth/` (ignorado por git).
- `chromium`: los flujos de `e2e/` en el navegador (login, tablero, nueva orden, ficha, presupuesto, enlace, portal, decisiones, avisos en vivo, flujo completo y accesibilidad con axe). Reutiliza la sesión del `setup`, salvo los tests que prueban el inicio de sesión real.
- `rls`: las pruebas de `tests/rls/` contra la base de datos real con la clave anónima (aislamiento entre talleres, RLS, portal, caducidad y revocación).

Antes de lanzar los E2E, ten en cuenta:

- **No dejes un `next dev` abierto en esta carpeta.** Playwright arranca su propio servidor en el puerto **3100** y Next no admite dos servidores de desarrollo en la misma carpeta. Ciérralo antes de ejecutar `npm run test:e2e`.
- **Supabase limita los inicios de sesión** por hora y por IP. Cada ejecución completa hace unos pocos inicios de sesión reales; si salta el límite, espera unos minutos y no encadenes ejecuciones completas.
- **Los tests dejan órdenes `E2E…` en la base de datos** (el taller no puede borrar órdenes). Con muchas ejecuciones se acumulan; el tablero muestra siempre todas las órdenes no entregadas (hasta 500) y las entregadas de los últimos 30 días (hasta 300), y avisa si algún límite recorta la lista. Para limpiarlas, vuelve a ejecutar `supabase/seed.sql`.
- **Límites del tablero y `Max rows` de Supabase.** Los límites de `src/domain/board-limits.ts` se diseñaron para el `Max rows` por defecto de Supabase (1000; Project Settings → API). Cada consulta pide límite + 1 filas para poder avisar, así que si se baja ese valor por debajo de 501 habría que bajar también esos límites.

## Arquitectura

```
src/
  domain/      Lógica pura y testeable (estados, importes en céntimos, matrículas, portal, WhatsApp...). Sin Next ni Supabase.
  lib/         Integraciones: clientes de Supabase (servidor, navegador y portal sin sesión), consultas y utilidades de entorno.
  components/  Componentes de interfaz compartidos (tarjetas, portal, aviso en vivo, botones de decisión).
  app/         Rutas (App Router): (taller) con tablero, nueva orden y ficha; login; logout; p/[token] (portal del cliente).
  proxy.ts     Refresca la sesión y protege las rutas del taller (en Next 16 el "middleware" se llama proxy).
supabase/
  migrations/  Esquema SQL numerado (0001_init, 0002_portal).
  seed.sql     Datos demo; re-ejecutable.
e2e/           Tests de Playwright de flujos (incluye flujo completo y accesibilidad).
tests/rls/     Tests de Playwright contra la base de datos real (RLS, portal).
```

Reglas: dinero siempre en céntimos enteros; las entradas de las acciones del servidor se validan con zod; todas las tablas tienen RLS y políticas explícitas.

## Portal del cliente y su seguridad

El taller pulsa "Enlace para el cliente" en la ficha de una orden y comparte `/p/<token>` (por WhatsApp o copiándolo). El cliente lo abre sin iniciar sesión, ve el estado, el presupuesto y aprueba o rechaza cada trabajo con una confirmación explícita.

- **Token:** 32 bytes aleatorios de un generador criptográfico, en hexadecimal (64 caracteres). **En la base de datos solo se guarda su hash** (SHA-256); el taller solo ve el enlace completo justo después de crearlo.
- **Caducidad y revocación:** el enlace caduca a los 7 días por defecto y se puede revocar. Un enlace nuevo revoca el anterior (solo hay uno activo por orden). Un enlace inexistente, caducado o revocado muestra la misma página genérica, sin pistas del motivo.
- **Sin acceso directo a las tablas:** el portal habla con la base de datos únicamente por dos funciones RPC con la clave anónima: `portal_get` (devuelve solo una lista blanca de campos) y `portal_decide` (decide una línea pendiente de una orden en "Esperando aprobación"; una decisión es definitiva). Las tablas no tienen política de lectura para el rol anónimo.
- **Sin `service_role`:** ninguna parte de la app usa esa clave.
- **Cabeceras de `/p/*`:** `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow` y sin caché (las pone `next.config.ts`). El proxy no consulta la sesión del taller en el portal.
- **Aviso en vivo:** cuando el cliente decide, el taller lo ve al momento (aviso, chip del tablero, ficha e historial) mediante Supabase Realtime, con las mismas políticas RLS que el resto de datos.

## Despliegue en Vercel

1. En Vercel: **Add New → Project** e **importa el repositorio**.
2. **Framework Preset:** Next.js (se detecta solo). Comando de build y carpeta de salida: los de por defecto.
3. **Environment Variables:** añade **solo** estas dos, para los entornos que vayas a usar (Production y, si quieres previews, Preview; Development solo si usas `vercel dev`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   **No añadas** las variables `E2E_*` (solo son para tests locales) ni, bajo ningún concepto, `service_role`. Las variables `NEXT_PUBLIC_*` se incorporan en la compilación: si las cambias, vuelve a desplegar.
4. **Deploy.**
5. **Supabase → Authentication → URL Configuration.** La app solo usa inicio de sesión con email y contraseña (`signInWithPassword`) y cierre de sesión. **No hay OAuth, enlace mágico, recuperación de contraseña ni confirmación por correo**, y el código no usa ninguna URL de redirección. Por eso:
   - **Imprescindible:** nada. La app funciona sin cambiar esta configuración; la sesión viaja por cookies del propio dominio y las llamadas a Supabase no dependen de estas URLs.
   - **Recomendable:** pon **Site URL** con la URL de producción (por ejemplo `https://tu-proyecto.vercel.app`), para que, si algún día se envía un correo de Auth (invitaciones, recuperación...), los enlaces no apunten a `http://localhost:3000`, que es el valor por defecto.
   - **Redirect URLs:** solo hace falta añadir la URL de producción (y, si más adelante se añaden flujos con redirección, un comodín para los previews como `https://*-tu-equipo.vercel.app/**`). Con el código actual no se consulta, así que es opcional.
6. **El origen del enlace del cliente no necesita ninguna variable:** la URL `https://<dominio>/p/<token>` se construye con las cabeceras de la petición (`x-forwarded-host`/`host` y `x-forwarded-proto`), así que sale con el dominio desde el que el taller usa la app (producción o preview).

Si usas un dominio propio, asígnalo en Vercel y usa ese dominio en Site URL.

### Comprobación después del despliegue

- [ ] Abrir la URL de producción y **iniciar sesión** con un usuario demo.
- [ ] El **tablero** carga con las órdenes demo, y el buscador por matrícula o cliente funciona.
- [ ] **Crear una orden** nueva, añadir trabajos al presupuesto y pasarla a "Esperando aprobación".
- [ ] **Generar el enlace** para el cliente: la URL empieza por el dominio de producción y termina en `/p/` seguido de 64 caracteres.
- [ ] **Abrir el enlace desde el móvil** (sin sesión del taller): se ven el estado y el presupuesto, y no hay scroll horizontal.
- [ ] **Decidir como cliente** (aprobar un trabajo y rechazar otro, confirmando) y ver en el ordenador del taller, **sin recargar**, el aviso en vivo, el chip del tablero, la decisión en la ficha y el evento del historial.
- [ ] Revocar el enlace y comprobar que el móvil ya muestra "Este enlace ya no está disponible".

## Cómo trabaja el equipo de agentes

El trabajo se reparte entre tres agentes. El **orquestador** (`CLAUDE.md`) no programa: lleva el plan y el bucle. **Develop** programa y **Testing** revisa contra `DIRECTRICES.md`. Los subagentes no pueden llamarse entre sí, así que el bucle lo lleva el orquestador.

```
PLAN.md ──► tarea T<n>
               │
               ▼
        ┌─────────────┐
        │ ORQUESTADOR │  (CLAUDE.md)
        └──────┬──────┘
               │ 1. tarea + criterios de aceptación
               ▼
        ┌─────────────┐
        │   DEVELOP   │  programa + escribe tests
        └──────┬──────┘
               │ 2. código listo
               ▼
        ┌─────────────┐   revisa contra DIRECTRICES.md
        │   TESTING   │   y ejecuta lint, tipos, build, tests
        └──────┬──────┘   informe: docs/revisiones/T<n>-vuelta<k>.md
               │
       ┌───────┴────────┐
   FALLOS:            APROBADO
       │                  │
       ▼                  ▼
 el orquestador     marca la tarea en PLAN.md
 pasa los fallos    actualiza PROGRESS.md
 tal cual a DEVELOP commit "feat(T<n>): ... (k vueltas)"
 y repite TESTING          │
 (máx. 5 vueltas;          ▼
  si no pasa, para    siguiente tarea
  y avisa al usuario)
```

### Archivos del sistema

- `CLAUDE.md` — orquestador y flujo obligatorio
- `.claude/agents/develop.md` — subagente que programa
- `.claude/agents/testing.md` — subagente que revisa (no toca código)
- `DIRECTRICES.md` — normas comprobables
- `PLAN.md` / `PROGRESS.md` — tareas y avance
- `docs/revisiones/` — informes de revisión por tarea y vuelta
- `.claude/settings.json` — impide a los agentes leer `.env*`

### Seguridad

Ninguna clave va en el código ni en el repo. Los secretos viven en `.env.local` (ignorado por git) y en las variables de entorno de Vercel.
