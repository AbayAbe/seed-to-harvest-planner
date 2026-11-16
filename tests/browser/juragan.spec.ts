import { test, expect, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";
import { masukApi } from "./helpers";

async function contoh(page: Page) {
  await masukApi(page);
  const response = await page.request.post("/api/lahan/contoh", { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).lahan as { id: string; nama: string }[];
}
test("masuk OTP simulasi, kode salah, sesi pulih saat reload, lalu keluar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Masuk pakai nomor HP." })).toBeVisible();
  await page.screenshot({ path: "output/ui-review/login-juragan-desktop.png", fullPage: true });
  await page.getByLabel("Nomor HP Anda").fill("123");
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(page.locator(".login-card").getByRole("alert")).toContainText("nomor HP");
  await page.getByLabel("Nomor HP Anda").fill(`0813${randomInt(10_000_000, 99_999_999)}`);
  await page.getByRole("button", { name: "SMS", exact: true }).click();
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  const kode = await page.getByTestId("kode-simulasi").innerText();
  await expect(page.getByRole("button", { name: /Kirim ulang/ })).toBeDisabled();
  await page.getByLabel("Kode masuk (6 angka)").fill(kode === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Masuk ke lahan saya" }).click();
  await expect(page.locator(".login-card").getByRole("alert")).toContainText("Kode belum cocok");
  await page.getByRole("button", { name: "Gunakan kode contoh" }).click();
  await page.getByRole("button", { name: "Masuk ke lahan saya" }).click();
  await expect(page.getByRole("heading", { name: "Lahan Anda, lebih terpantau." })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "agri_sesi")?.httpOnly).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Lahan Anda, lebih terpantau." })).toBeVisible();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page.getByLabel("Nomor HP Anda")).toBeVisible();
  expect((await page.request.get("/api/lahan")).status()).toBe(401);
});

test("kartu mengambil cuaca tiap lahan dan membuka tanaman, tanggal, serta luas yang benar", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = () => { throw new Error("Lokasi HP tidak boleh dipakai"); };
  });
  await contoh(page);
  const cuacaRequests: string[] = [];
  page.on("request", (request) => { if (/\/api\/lahan\/[^/]+\/cuaca/.test(request.url())) cuacaRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.locator(".farm-card")).toHaveCount(3);
  const jagung = page.getByRole("article", { name: "Lahan Jagung A" });
  const padi = page.getByRole("article", { name: "Lahan Padi B" });
  await expect(jagung.getByText("Tunda Penyemprotan Obat!", { exact: true })).toBeVisible();
  await expect(padi.getByLabel("Cuaca Lahan Padi B")).toContainText("Cerah");
  await expect(page.getByLabel("Cuaca Lahan Cabai C")).toContainText("Berawan");
  expect(new Set(cuacaRequests.map((url) => url.split("?")[0])).size).toBe(3);
  await page.screenshot({ path: "output/ui-review/juragan-desktop.png", fullPage: true });
  await padi.getByRole("button", { name: "Lihat Jadwal Tanam & Obat" }).click();
  await expect(page.getByLabel("Jenis tanaman")).toHaveValue("padi-demo");
  await expect(page.getByLabel("Tanggal mulai tanam")).toHaveValue("2026-11-08");
  await expect(page.getByLabel("Rencana panen (hari setelah tanam)")).toHaveValue("110");
  await page.getByRole("navigation").getByRole("button", { name: /Kalkulator dosis/ }).click();
  await expect(page.getByLabel("Luas lahan (hektare)", { exact: true })).toHaveValue("4.2");
  await page.getByRole("navigation").getByRole("button", { name: /Lahan saya/ }).click();
  await jagung.getByRole("button", { name: "Lihat Jadwal Tanam & Obat" }).click();
  await expect(page.getByLabel("Jenis tanaman")).toHaveValue("dekalb-dk771-corn");
  await expect(page.getByLabel("Tanggal mulai tanam")).toHaveValue("2026-11-01");
  expect(errors).toEqual([]);
});

test("menambah lahan dengan koordinat manual dan melihatnya lagi setelah reload", async ({ page }) => {
  await masukApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Tambah lahan", exact: true }).click();
  await page.getByLabel("Nama lahan", { exact: true }).fill("Kebun Tomat Selatan");
  await page.getByRole("form", { name: "Tambah lahan" }).getByLabel("Luas lahan (hektare)", { exact: true }).fill("1,25");
  await page.getByLabel("Tanaman di lahan ini").selectOption("tomat-demo");
  await page.locator("#tanggal-lahan").fill("2026-12-01");
  await page.getByLabel("Lokasi lahan", { exact: true }).selectOption("manual");
  await page.getByLabel("Desa atau wilayah").fill("Desa Sukamaju");
  await page.getByLabel("Lintang (latitude)").fill("91");
  await page.getByLabel("Bujur (longitude)").fill("107,758");
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  await expect(page.getByRole("form", { name: "Tambah lahan" }).getByRole("alert")).toContainText("Koordinat");
  await page.getByLabel("Lintang (latitude)").fill("-6,571");
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  await expect(page.getByRole("article", { name: "Kebun Tomat Selatan" })).toContainText("1,25");
  await page.reload();
  const card = page.getByRole("article", { name: "Kebun Tomat Selatan" });
  await expect(card).toBeVisible();
  await card.locator("summary").click();
  await expect(card).toContainText("Lintang: -6.571");
  await card.getByRole("button", { name: "Lihat Jadwal Tanam & Obat" }).click();
  await expect(page.getByLabel("Tanggal mulai tanam")).toHaveValue("2026-12-01");
  await expect(page.getByLabel("Jenis tanaman")).toHaveValue("tomat-demo");
});

test("kegagalan cuaca satu lahan tidak menghalangi lainnya dan sesi habis kembali ke login", async ({ page }) => {
  const farms = await contoh(page);
  const id = farms.find((farm) => farm.nama === "Lahan Jagung A")!.id;
  await page.route(`**/api/lahan/${id}/cuaca?*`, (route) => route.abort("connectionfailed"), { times: 1 });
  await page.goto("/");
  const jagung = page.getByRole("article", { name: "Lahan Jagung A" });
  await expect(jagung).toContainText("Cuaca belum tersedia");
  await expect(jagung.getByText("Cerah", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Cuaca Lahan Padi B")).toContainText("Cerah");
  await jagung.getByRole("button", { name: "Muat ulang cuaca" }).click();
  await expect(jagung).toContainText("Tunda Penyemprotan Obat!");
  await page.request.post("/api/auth/logout", { data: {} });
  await page.getByRole("button", { name: "Perbarui cuaca" }).click();
  await expect(page.getByLabel("Nomor HP Anda")).toBeVisible();
  await expect(page.locator(".farm-card")).toHaveCount(0);
});

test("layar HP tidak melebar dan semua kontrol lahan serta login minimal 64 piksel", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByLabel("Nomor HP Anda")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const control of await page.locator(".login-card button, .login-card input").all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await page.screenshot({ path: "output/ui-review/login-juragan-mobile.png", fullPage: true });
  await contoh(page);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".farm-card")).toHaveCount(3);
    await expect(page.getByLabel("Cuaca Lahan Jagung A")).toContainText("Hujan");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    for (const control of await page.locator(".app-shell button:visible, .app-shell summary:visible").all()) {
      if (await control.getAttribute("data-nextjs-dev-tools-button") !== null) continue;
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(64);
    }
    if (width === 390) await page.screenshot({ path: "output/ui-review/juragan-mobile.png", fullPage: true });
  }
});
