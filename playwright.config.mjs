import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error("E2E_BASE_URL is required to run the browser suite.");

export const AUTH_FILE = "playwright/.auth/qa.json";

// O bypass da proteção da Vercel é adicionado só às requisições para a própria aplicação
// (ver tests/e2e/fixtures.mjs), nunca a terceiros como o Supabase.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  outputDir: "test-results/output",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Sem trace/vídeo no login: o trace grava os valores digitados (senha).
    {
      name: "setup",
      testMatch: /auth\.setup\.mjs$/,
      use: { ...devices["Desktop Chrome"], trace: "off", video: "off", screenshot: "off" },
    },
    {
      name: "chromium",
      testMatch: /.*\.spec\.mjs$/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
  ],
});
