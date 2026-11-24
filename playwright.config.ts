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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env,
  },
});
