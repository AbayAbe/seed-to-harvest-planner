import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", browserName: "chromium", channel: "msedge", headless: true, viewport: { width: 1440, height: 1050 } },
  webServer: [
    { command: "npm run dev:backend", url: "http://127.0.0.1:4100/api/health", reuseExistingServer: false, timeout: 30000,
      env: { DATABASE_PATH: ":memory:", PORT: "4100", FRONTEND_ORIGINS: "http://localhost:3100,http://127.0.0.1:3100" } },
    { command: "node node_modules/next/dist/bin/next dev frontend --port 3100 --hostname 127.0.0.1", url: "http://localhost:3100", reuseExistingServer: false, timeout: 60000,
      env: { BACKEND_URL: "http://127.0.0.1:4100", AGRI_E2E: "true" } },
  ],
});
