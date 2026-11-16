import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/pages", workers: 1, reporter: "list",
  use: { browserName: "chromium", channel: "msedge", headless: true, viewport: { width: 390, height: 844 } },
});
