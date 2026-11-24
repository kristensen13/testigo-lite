# Testigo Lite

Aplicación Next.js 16 (App Router) + TypeScript + Tailwind 4, con Supabase (Postgres + Auth), desplegada en Vercel. La definición del producto está en `PRODUCT.md`.

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Las variables de entorno van en `.env.local` (nunca se versiona).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Comprobación de tipos |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests de flujos (Playwright) |

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
