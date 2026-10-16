import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT) || 3100;

/**
 * E2E tests run against a production build backed by an in-memory MongoDB seeded with demo data
 * (scripts/dev-memory.ts). Run `npm run build` first.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: "npx tsx scripts/dev-memory.ts --prod",
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), MEMORY_DB_PORT: "27028" },
  },
});
