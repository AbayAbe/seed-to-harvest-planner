import { test, expect, type Page } from "@playwright/test";
import { masukApi, bukaPlanner } from "./helpers";

test.beforeEach(async ({ page }) => { await masukApi(page); });

async function fillCalculator(page: Page) {
  await bukaPlanner(page);
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: /Kalkulator dosis/ }).click();
  await page.getByLabel("Produk Bayer").selectOption("nativo");
  await page.getByLabel("Luas lahan (hektare)", { exact: true }).fill("1");
  await page.getByLabel("Kapasitas tangki (liter)", { exact: true }).fill("15");
  await page.getByLabel("Dosis produk (gram/ha)", { exact: true }).fill("400");
  await page.getByLabel("Air per hektare (liter/ha)", { exact: true }).fill("200");
}
test("catalog connection failure has a working retry", async ({ page }) => {
  await page.route("**/api/catalog", (route) => route.abort("connectionfailed"), { times: 1 });
  await bukaPlanner(page);
  await expect(page.locator("#main-content").getByRole("alert")).toContainText("Belum dapat terhubung");
  await page.getByRole("button", { name: "Coba muat lagi" }).click();
  await expect(page.getByLabel("Jenis tanaman").locator("option")).toHaveCount(8);
  await expect(page.locator(".timeline-item")).toHaveCount(5);
});
test("timeline failure hides previous schedule and retry uses the new inputs", async ({ page }) => {
  await bukaPlanner(page);
  await expect(page.locator(".timeline-item")).toHaveCount(5);
  await page.route("**/api/timeline", (route) => route.abort("connectionfailed"), { times: 1 });
  await page.getByLabel("Jenis tanaman").selectOption("padi-demo");
  await expect(page.locator("#schedule-error")).toContainText("Belum dapat terhubung");
  await expect(page.locator(".timeline-item")).toHaveCount(0);
  const response = page.waitForResponse((item) => item.url().endsWith("/api/timeline") && item.status() === 200);
  await page.getByRole("button", { name: "Coba buat jadwal lagi" }).click();
  const payload = await (await response).json();
  expect(payload.tasks.every((item: { seedId: string }) => item.seedId === "padi-demo")).toBeTruthy();
  await expect(page.locator(".timeline-item")).toHaveCount(5);
});
test("calculator failure recovers through the separate API", async ({ page }) => {
  await fillCalculator(page);
  await page.route("**/api/tank-mix", (route) => route.abort("connectionfailed"), { times: 1 });
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.locator(".mix-form").getByRole("alert")).toContainText("Belum dapat terhubung");
  await expect(page.locator(".recipe-amount")).toHaveCount(0);
  const response = page.waitForResponse((item) => item.url().endsWith("/api/tank-mix") && item.status() === 200);
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  expect((await (await response).json()).numberOfTanks).toBe(14);
  await expect(page.locator(".repeat-callout")).toContainText("14×");
});
test("editing while a calculation is pending discards its late response", async ({ page }) => {
  await fillCalculator(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let finished!: () => void;
  const settled = new Promise<void>((resolve) => { finished = resolve; });
  await page.route("**/api/tank-mix", async (route) => {
    try {
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    } catch { /* An aborted browser request may already be disposed. */ }
    finally { finished(); }
  }, { times: 1 });
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sedang menghitung…" })).toBeDisabled();
  await page.getByLabel("Luas lahan (hektare)", { exact: true }).fill("0,5");
  release();
  await settled;
  await expect(page.locator(".recipe-amount")).toHaveCount(0);
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.locator(".repeat-callout")).toContainText("7×");
});
