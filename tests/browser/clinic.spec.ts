import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { masukApi } from "./helpers";

test.beforeEach(async ({ page }) => { await masukApi(page); });

test("dashboard klinik menyimpan pengamatan tanpa mengirim foto ke API", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", r => { if(r.url().includes("/api/clinic")) calls.push(r.url()); });
  await page.goto("/klinik/");
  await expect(page.getByLabel("Unggah foto tanaman", { exact: true })).toBeEnabled();
  await page.getByLabel("Unggah foto tanaman", { exact: true }).setInputFiles({ name: "leaf.png", mimeType: "image/png", buffer: await sharp({ create: { width: 100, height: 80, channels: 3, background: "green" } }).png().toBuffer() });
  await expect(page.getByAltText("Pratinjau foto pengamatan tanaman")).toBeVisible();
  await page.getByRole("combobox", { name: "Jenis tanaman", exact: true }).selectOption("Cabai");
  await page.getByLabel("Nama lahan", { exact: false }).fill("Kebun utara");
  await page.getByLabel("Catatan gejala", { exact: true }).fill("Daun terlihat menguning sejak kemarin.");
  await page.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(page.getByRole("form", { name: "Catatan pengamatan tanaman" }).getByRole("status")).toContainText("Catatan tersimpan");
  await page.reload();
  await expect(page.getByLabel("Riwayat pengamatan")).toContainText("Kebun utara");
  await expect(page.getByLabel("Riwayat pengamatan")).toContainText("Daun terlihat menguning");
  await expect(page.getByAltText("Pratinjau foto pengamatan tanaman")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "output/ui-review/clinic-dashboard-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "output/ui-review/clinic-dashboard-desktop.png", fullPage: true });
  expect(calls).toEqual([]);
});

test("invalid file and unavailable storage do not give false success", async ({ page }) => {
  await page.goto("/klinik/");
  await expect(page.getByLabel("Unggah foto tanaman", { exact: true })).toBeEnabled();
  await page.getByLabel("Unggah foto tanaman", { exact: true }).setInputFiles({ name:"bad.txt", mimeType:"text/plain", buffer:Buffer.from("bad") });
  await expect(page.locator("p[role=alert]")).toContainText("Pilih foto");
  await page.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Tuliskan gejala");
  await page.getByLabel("Catatan gejala", { exact:true }).fill("Periksa daun");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); }; });
  await page.getByRole("button", { name:"Simpan catatan" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Catatan belum tersimpan");
  await expect(page.getByRole("form", { name: "Catatan pengamatan tanaman" }).getByRole("status")).toHaveCount(0);
});
