import { defineConfig, devices } from "@playwright/test";

// Carga .env.local si existe (sin él, los tests usan valores de relleno).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No existe: se sigue con los valores de relleno de más abajo.
}

// Valores de relleno no secretos: solo se usan si faltan los reales. Los tests
// sin sesión no llegan a contactar con Supabase.
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key-de-relleno",
} as Record<string, string>;

const PORT = 3100;

const args = process.argv.join(" ");
const soloRls = /--project[= ]rls(\s|$)/.test(args) && !/--project[= ]chromium/.test(args);

export default defineConfig({
  fullyParallel: true,
  // 12 workers sobre un único `next dev` y Supabase producen atascos de acciones de servidor de 45-60 s.
  workers: 4,
  // Margen para el primer render con el servidor dev en frío (compilación + streaming).
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // Un único inicio de sesión real; el resto de tests reutiliza la sesión.
    { name: "setup", testDir: "./e2e", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testDir: "./e2e",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
    // Pruebas de RLS contra la BD real con la clave anónima (sin navegador).
    // Sin paralelismo dentro de cada archivo: se reutiliza la sesión del worker.
    { name: "rls", testDir: "./tests/rls", fullyParallel: false },
  ],
  // Si solo se ejecuta el proyecto rls no hace falta levantar la app.
  webServer: soloRls
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env,
      },
});
