import { test, expect, type Page } from "@playwright/test";
import { masukApi, bukaPlanner } from "./helpers";

test.beforeEach(async ({ page }) => { await masukApi(page); });

async function openCalculator(page: Page) {
  await bukaPlanner(page);
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: /Kalkulator dosis/ }).click();
}
async function fillExample(page: Page) {
  await page.getByRole("combobox", { name: "Produk Bayer" }).selectOption("nativo");
  await page.getByLabel("Luas lahan (hektare)", { exact: true }).fill("1");
  await page.getByLabel("Kapasitas tangki (liter)", { exact: true }).fill("15");
  await page.getByLabel("Dosis produk (gram/ha)", { exact: true }).fill("400");
  await page.getByLabel("Air per hektare (liter/ha)", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.locator(".repeat-callout")).toContainText("14×");
}

test("timeline shows actual delayed day, filters and date validation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Lahan Anda, lebih terpantau." })).toBeVisible();
  await page.bringToFront();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Langsung ke isi" }), await page.evaluate(() => JSON.stringify({ active: document.activeElement?.outerHTML, shadow: document.activeElement?.shadowRoot?.activeElement?.outerHTML }))).toBeFocused();
  await expect(page.getByRole("link", { name: "Langsung ke isi" })).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: /Jadwal tanam/ }).click();
  await expect(page.getByRole("heading", { name: "Musim tanam Anda." })).toBeVisible();
  await expect(page.getByRole("button", { name: /18 Nov 2026 · Hari ke-17/ })).toBeVisible();
  await page.getByRole("button", { name: /18 Nov 2026 · Hari ke-17/ }).click();
  await expect(page.getByText("Rencana awal:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Jadwal bergeser 2", exact: true }).click();
  await expect(page.locator(".timeline-item")).toHaveCount(2);
  await page.getByLabel("Tanggal mulai tanam").fill("");
  await expect(page.locator("#schedule-error")).toContainText("Pilih tanggal tanam");
  await page.getByLabel("Tanggal mulai tanam").fill("2026-11-01");
  await page.getByRole("button", { name: "Semua kegiatan 5", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/ui-review/desktop-timeline.png", fullPage: true });
});

test("calculator validates, computes, clears stale results, and resets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openCalculator(page);
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.getByText("Pilih produk yang akan digunakan.")).toBeVisible();
  await fillExample(page);
  await expect(page.locator(".recipe-amount").first()).toContainText("28,57");
  await expect(page.locator(".recipe-amount").last()).toContainText("14,29");
  await expect(page.locator(".repeat-callout")).toContainText("14×");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/ui-review/desktop-calculator.png", fullPage: true });
  await page.getByLabel("Luas lahan (hektare)", { exact: true }).fill("0");
  await expect(page.locator(".recipe-amount")).toHaveCount(0);
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.getByText("Isi luas lahan dengan angka lebih dari nol.")).toBeVisible();
  await page.getByLabel("Luas lahan (hektare)", { exact: true }).fill("0,5");
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.locator(".repeat-callout")).toContainText("7×");
  await page.getByRole("combobox", { name: "Produk Bayer" }).selectOption("decis");
  await expect(page.getByLabel("Dosis produk (ml/ha)", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Air per hektare (liter/ha)", { exact: true })).toHaveValue("");
  await expect(page.locator(".recipe-amount")).toHaveCount(0);
  await page.getByRole("button", { name: "Kosongkan semua isian" }).click();
  await expect(page.getByLabel("Luas lahan (hektare)", { exact: true })).toHaveValue("");
  expect(errors).toEqual([]);
});

test("mobile has no horizontal overflow and controls remain easy to tap", async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await openCalculator(page);
    await fillExample(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    const controls = page.locator(".app-shell button:visible, .app-shell input:visible, .app-shell select:visible, .app-shell a.reference-link:visible");
    for (let index = 0; index < await controls.count(); index++) {
      const control = controls.nth(index);
      if (await control.getAttribute("data-nextjs-dev-tools-button") !== null) continue;
      const bounds = await control.boundingBox();
      if (bounds) expect(bounds.height).toBeGreaterThanOrEqual(64);
    }
    if (width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "output/ui-review/mobile-calculator.png", fullPage: true });
    }
  }
});
