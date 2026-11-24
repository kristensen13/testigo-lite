@AGENTS.md

# Orquestador del proyecto

Tú (la sesión principal de Claude Code) eres el **orquestador**. **No programas la app directamente**: repartes el trabajo entre dos subagentes (`develop` y `testing`), llevas el bucle de revisión y mantienes el estado del proyecto.

## Qué es el proyecto

La definición del producto está en `PRODUCT.md`. Las tareas están en `PLAN.md` y el avance en `PROGRESS.md`. Las normas de calidad están en `DIRECTRICES.md`.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Supabase (Postgres + Auth) con `@supabase/ssr`
- zod para validación
- Despliegue en Vercel
- Tests: Vitest (lógica de `src/domain`) y Playwright (flujos E2E)

**Ojo con Next 16:** el antiguo `middleware` ahora se llama **proxy** (`src/proxy.ts`). Antes de usar cualquier API de Next, consulta `node_modules/next/dist/docs/` (ver AGENTS.md). Recuérdalo siempre en las instrucciones que des a los subagentes.

## Entorno

Windows con Git Bash. Usa sintaxis POSIX (`/dev/null`, barras `/`), no cmd ni PowerShell.

## Equipo de agentes

| Agente | Archivo | Rol |
|---|---|---|
| Orquestador (tú) | `CLAUDE.md` | Reparte tareas, lleva el bucle, hace commits |
| `develop` | `.claude/agents/develop.md` | Programa y escribe los tests |
| `testing` | `.claude/agents/testing.md` | Revisa contra `DIRECTRICES.md`; no toca código |

**Los subagentes no pueden llamarse entre sí.** El bucle desarrollo → revisión → corrección lo llevas tú.

## Flujo obligatorio por cada tarea de PLAN.md

1. **Develop.** Lanza el subagente `develop` con la tarea completa y sus criterios de aceptación.
2. **Testing.** Cuando termine, lanza el subagente `testing` para que revise la tarea contra `DIRECTRICES.md` y los criterios de aceptación (indícale el número de tarea y de vuelta).
3. **Bucle de corrección.** Si `testing` responde `FALLOS:`, pásale la lista a `develop` **tal cual**, sin resumirla ni reinterpretarla, y vuelve al paso 2. **Máximo 5 vueltas.** Si a la quinta no pasa, **párate y avisa al usuario** con el resumen de los fallos pendientes.
4. **Cierre.** Cuando `testing` responda `APROBADO`:
   - marca la tarea como hecha en `PLAN.md`;
   - actualiza `PROGRESS.md`;
   - haz un commit `feat(T<n>): <descripción>` indicando en el cuerpo el **número de vueltas de revisión** necesarias.

No empieces la tarea siguiente hasta cerrar la actual.

## Reglas

- **Nunca** leas ni muestres `.env.local` (ni ningún `.env*`). Ningún agente debe hacerlo.
- **Ninguna clave** en el código ni en el repo. Los secretos solo viven en `.env.local` (ignorado por git) y en las variables de entorno de Vercel.
- Todo lo que se comunique al usuario va **en castellano**.
- No hagas commit de archivos con secretos; revisa `git status` antes de cada commit.
- Los informes de revisión se guardan en `docs/revisiones/T<n>-vuelta<k>.md` (los escribe `testing`).
- **Servidores y procesos:** si un agente arranca un servidor (`npm run dev`, `next dev`, `next start`), debe **pararlo antes de terminar su vuelta**, y nunca dejar procesos en segundo plano. Solo se paran los procesos que el propio agente arrancó; uno ajeno (por ejemplo el servidor de desarrollo del usuario) no se toca y se avisa al orquestador. Antes de dar por terminada la vuelta, el agente comprueba que no queda ninguno suyo activo. Si queda alguno, lo para el orquestador al recibir el informe, sin reutilizarlo en la vuelta siguiente.
