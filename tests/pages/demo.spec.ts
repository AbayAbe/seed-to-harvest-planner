import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

let server: Server;
let base: string;
const prefix = "/seed-to-harvest-planner";
test.beforeAll(async () => {
  const root = resolve("frontend/out");
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const relative = decodeURIComponent(url.pathname).slice(prefix.length);
    const file = resolve(root, `.${relative.endsWith("/") ? relative + "index.html" : relative}`);
    if (!url.pathname.startsWith(prefix + "/") || !file.startsWith(root + sep)) { res.writeHead(404).end(); return; }
    try {
      const data = await readFile(file);
      res.setHeader("Content-Type", ({ ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" } as Record<string, string>)[extname(file)] ?? "application/octet-stream");
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server tes gagal dibuka.");
  base = `http://127.0.0.1:${address.port}${prefix}/`;
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test("demo statis: lahan, cuaca, jadwal, dosis, penyimpanan, dan keluar tanpa API", async ({ page, context }) => {
  const errors: string[] = [], failures: string[] = [], apiCalls: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (r.status() >= 400) failures.push(r.url()); });
  page.on("request", r => { if (r.url().includes("/api/")) apiCalls.push(r.url()); });
  await page.goto(base);
  await page.getByRole("button", { name: "Buka demo", exact: true }).click();
  await page.getByRole("button", { name: "Coba dengan 3 lahan contoh" }).click();
  await expect(page.locator(".farm-card")).toHaveCount(3);
  await expect(page.getByLabel("Cuaca Lahan Jagung A")).toContainText("Hujan");
  await expect(page.getByLabel("Cuaca Lahan Padi B")).toContainText("Cerah");
  await page.getByRole("article", { name: "Lahan Padi B" }).getByRole("button", { name: "Lihat Jadwal Tanam & Obat" }).click();
  await expect(page.getByLabel("Jenis tanaman")).toHaveValue("padi-demo");
  await expect(page.locator(".timeline-item").first()).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: /Kalkulator dosis/ }).click();
  await page.getByLabel("Produk Bayer").selectOption("nativo");
  await page.getByLabel("Luas lahan (hektare)", { exact: true }).fill("1");
  await page.getByLabel("Kapasitas tangki (liter)").fill("15");
  await page.getByLabel("Dosis produk (gram/ha)").fill("400");
  await page.getByLabel("Air per hektare (liter/ha)").fill("200");
  await page.getByRole("button", { name: "Hitung campuran", exact: true }).click();
  await expect(page.locator(".repeat-callout")).toContainText("14×");
  await expect(page.locator(".recipe-amount").first()).toContainText("28,57");
  await page.reload();
  await expect(page.locator(".farm-card")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "output/ui-review/github-pages-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Buka demo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Buka demo", exact: true }).click();
  await expect(page.locator(".farm-card")).toHaveCount(3);
  const other = await context.newPage();
  await other.goto(base);
  await other.getByRole("button", { name: "Buka demo", exact: true }).click();
  await expect(other.locator(".farm-card")).toHaveCount(3);
  expect(apiCalls).toEqual([]); expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test("data rusak tidak ditimpa", async ({ page }) => {
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem("agri:pages:lahan:v1", "rusak"));
  await page.getByRole("button", { name: "Buka demo", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Data di browser belum bisa dibaca");
  expect(await page.evaluate(() => localStorage.getItem("agri:pages:lahan:v1"))).toBe("rusak");
});

test("penyimpanan penuh saat menambah lahan tidak memberi keberhasilan palsu", async ({ page }) => {
  await page.goto(base);
  await page.getByRole("button", { name: "Buka demo", exact: true }).click();
  await page.getByRole("button", { name: "Tambah lahan", exact: true }).click();
  await page.getByLabel("Nama lahan", { exact: true }).fill("Kebun Uji");
  await page.getByRole("form", { name: "Tambah lahan" }).getByLabel("Luas lahan (hektare)", { exact: true }).fill("1,25");
  await page.getByLabel("Tanaman di lahan ini").selectOption("tomat-demo");
  await page.locator("#tanggal-lahan").fill("2026-12-01");
  await page.getByLabel("Lokasi lahan", { exact: true }).selectOption("manual");
  await page.getByLabel("Desa atau wilayah").fill("Desa Contoh");
  await page.getByLabel("Lintang (latitude)").fill("-6,571");
  await page.getByLabel("Bujur (longitude)").fill("107,758");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "agri:pages:lahan:v1") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  await expect(page.getByRole("form", { name: "Tambah lahan" }).getByRole("alert")).toContainText("Lahan belum tersimpan");
  expect(await page.evaluate(() => localStorage.getItem("agri:pages:lahan:v1"))).toBeNull();
});
