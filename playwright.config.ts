import { defineConfig, devices } from "@playwright/test";

const e2eHost = "127.0.0.1";
const e2eApiPort = 4180;
const e2eWebPort = 5178;
const e2eApiUrl = `http://${e2eHost}:${e2eApiPort}`;
const e2eWebUrl = `http://${e2eHost}:${e2eWebPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/e2e-results.json" }]
  ],
  use: {
    baseURL: e2eWebUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } }
  ],
  webServer: [
    {
      command: `npm run build -w @edupath/api && PORT=${e2eApiPort} DEMO_MODE=true WEB_ORIGINS=${e2eWebUrl} node apps/api/dist/server.js`,
      url: `${e2eApiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: `VITE_PROXY_TARGET=${e2eApiUrl} npm run build -w @edupath/web && VITE_PROXY_TARGET=${e2eApiUrl} npm run preview -w @edupath/web -- --host ${e2eHost} --port ${e2eWebPort} --strictPort`,
      url: e2eWebUrl,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
