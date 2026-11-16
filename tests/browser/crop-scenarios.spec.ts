import { test, expect } from "@playwright/test";
import { masukApi, bukaPlanner } from "./helpers";

test.beforeEach(async ({ page }) => { await masukApi(page); });

test("crop/weather selection, persistent rain, and harvest conflicts are visible and recoverable", async ({ page }) => {
  await bukaPlanner(page);
  await expect(page.getByLabel("Jenis tanaman").locator("option")).toHaveCount(8);
  await page.getByLabel("Jenis tanaman").selectOption("padi-demo");
  await expect(page.getByLabel("Ringkasan rencana")).toContainText("Padi");
  await expect(page.getByLabel("Rencana panen (hari setelah tanam)")).toHaveValue("110");
  await page.getByLabel("Skenario cuaca").selectOption("persistent-rain");
  await expect(page.getByRole("region", { name: "Kegiatan perlu ditinjau" })).toContainText("2 kegiatan perlu ditinjau");
  await expect(page.locator(".timeline-item")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Rencana panen Titik panen simulasi/ })).toBeVisible();
  await page.getByLabel("Skenario cuaca").selectOption("dry");
  await expect(page.locator(".review-panel")).toHaveCount(0);
  await expect(page.locator(".timeline-item")).toHaveCount(5);
  await page.getByLabel("Jenis tanaman").selectOption("mentimun-demo");
  await page.getByLabel("Rencana panen (hari setelah tanam)").fill("18");
  await expect(page.locator(".review-panel")).toContainText("melewati rencana panen");
  await page.getByLabel("Rencana panen (hari setelah tanam)").fill("0");
  await expect(page.locator("#schedule-error")).toContainText("bilangan bulat lebih dari nol");
  await page.getByLabel("Jenis tanaman").selectOption("cabai-demo");
  await expect(page.getByLabel("Rencana panen (hari setelah tanam)")).toHaveValue("80");
  await page.getByLabel("Skenario cuaca").selectOption("repeated-rain");
  await expect(page.locator(".timeline-list")).toContainText("Bergeser 6 hari");
  await page.screenshot({ path: "output/ui-review/crop-scenarios-desktop.png", fullPage: true });
});

test("all crop choices work at phone width, including manual review layout", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await bukaPlanner(page);
  await expect(page.getByLabel("Jenis tanaman").locator("option")).toHaveCount(8);
  const values = await page.getByLabel("Jenis tanaman").locator("option").evaluateAll((options) => options.map((item) => (item as HTMLOptionElement).value));
  for (const value of values) {
    await page.getByLabel("Jenis tanaman").selectOption(value);
    await page.getByLabel("Skenario cuaca").selectOption("persistent-rain");
    await expect(page.locator(".review-panel")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/ui-review/crop-scenarios-mobile.png", fullPage: true });
});
