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

test("akses langsung: lahan, cuaca, jadwal, dosis, dan penyimpanan tanpa API", async ({ page, context }) => {
  const errors: string[] = [], failures: string[] = [], apiCalls: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (r.status() >= 400) failures.push(r.url()); });
  page.on("request", r => { if (r.url().includes("/api/")) apiCalls.push(r.url()); });
  await page.goto(base);
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
  await expect(page.getByRole("button", { name: "Keluar", exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/demo/i);
  await expect(page.locator(".farm-card")).toHaveCount(3);
  const other = await context.newPage();
  await other.goto(base);
  await expect(other.locator(".farm-card")).toHaveCount(3);
  expect(apiCalls).toEqual([]); expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test("data rusak tidak ditimpa", async ({ page }) => {
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem("agri:pages:lahan:v1", "rusak"));
  await page.reload();
  await expect(page.locator("p[role=alert]")).toContainText("Data di browser belum bisa dibaca");
  expect(await page.evaluate(() => localStorage.getItem("agri:pages:lahan:v1"))).toBe("rusak");
});

test("lahan versi lama tetap terbaca tanpa sesi login", async ({ page }) => {
  await page.goto(base);
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.setItem("agri:pages:lahan:v1", JSON.stringify([{
      id: "lahan-lama", penggunaId: "demo-browser", nama: "Kebun tersimpan", lokasi: "Garut",
      luasHektare: 1.5, latitude: -7.215, longitude: 107.901, seedId: "padi-demo",
      tanggalTanam: "2026-11-01", hariPanen: 110, topikMqtt: null, dibuatPada: "2026-11-01T00:00:00.000Z",
    }]));
  });
  await page.reload();
  await expect(page.getByRole("article", { name: "Kebun tersimpan" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Buka demo|Keluar/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("agri:pages:lahan:v1")!)[0].id)).toBe("lahan-lama");
});

test("penyimpanan penuh saat menambah lahan tidak memberi keberhasilan palsu", async ({ page }) => {
  await page.goto(base);
  await page.getByRole("button", { name: "Tambah lahan", exact: true }).last().click();
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
      if (key === "agri:workspace:v2") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  await expect(page.getByRole("form", { name: "Tambah lahan" }).getByRole("alert")).toContainText("Lahan belum tersimpan");
  expect(await page.evaluate(() => localStorage.getItem("agri:pages:lahan:v1"))).toBeNull();
});

test("agenda, biaya, pencarian, dan cadangan bertahan setelah muat ulang", async ({ page }) => {
  await page.goto(base);
  await page.getByRole("button", { name: "Coba dengan 3 lahan contoh" }).click();
  await page.getByRole("button", { name: "Tambah kegiatan", exact: true }).click();
  await page.getByLabel("Nama kegiatan").fill("Periksa irigasi");
  await page.getByLabel("Biaya kegiatan (Rp)").fill("150000");
  await page.getByLabel("Catatan lapangan").fill("Saluran bagian timur");
  await page.getByRole("button", { name: "Simpan kegiatan" }).click();
  await expect(page.locator(".pro-agenda-foot")).toContainText("150.000");
  await page.getByRole("button", { name: "Tandai selesai: Periksa irigasi" }).click();
  await expect(page.locator(".pro-money")).toContainText("150.000");
  await page.reload();
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.locator(".pro-activity-list")).toContainText("Saluran bagian timur");
  await page.getByLabel("Cari lahan", { exact: true }).fill("Padi");
  await expect(page.locator(".farm-card")).toHaveCount(1);
  await page.getByLabel("Cari lahan", { exact: true }).fill("");
  const original = await page.evaluate(() => localStorage.getItem("agri:workspace:v2"));
  await page.getByLabel("File cadangan").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"version":2,"farms":[],"kegiatan":[{}]}') });
  await expect(page.locator("p[role=alert]")).toContainText("tidak valid");
  expect(await page.evaluate(() => localStorage.getItem("agri:workspace:v2"))).toBe(original);
  await page.getByLabel("File cadangan").setInputFiles({ name: "empty.json", mimeType: "application/json", buffer: Buffer.from('{"version":2,"farms":[],"kegiatan":[]}') });
  await expect(page.getByText("Periksa sebelum memulihkan")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("agri:workspace:v2"))).toBe(original);
  await page.getByRole("button", { name: "Batal pemulihan" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh cadangan" }).click();
  expect((await downloading).suggestedFilename()).toMatch(/^lahan-saya-.*\.json$/);
  await page.getByLabel("File cadangan").setInputFiles({ name: "empty.json", mimeType: "application/json", buffer: Buffer.from('{"version":2,"farms":[],"kegiatan":[]}') });
  await page.getByRole("button", { name: "Ganti data dengan cadangan ini" }).click();
  await expect(page.locator(".farm-card")).toHaveCount(0);
  await page.getByLabel("File cadangan").setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(original!) });
  await page.getByRole("button", { name: "Ganti data dengan cadangan ini" }).click();
  await expect(page.locator(".farm-card")).toHaveCount(3);
  await expect(page.locator(".pro-money")).toContainText("150.000");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "output/ui-review/workspace-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("ubah lahan mempertahankan identitas dan kegiatan", async ({ page }) => {
  await page.goto(base);
  await page.getByRole("button", { name: "Coba dengan 3 lahan contoh" }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("agri:workspace:v2")!).farms.find((f: {nama:string}) => f.nama === "Lahan Padi B"));
  await page.getByRole("button", { name: "Ubah Lahan Padi B", exact: true }).click();
  await page.getByRole("form", { name: "Ubah lahan" }).getByLabel("Nama lahan", { exact: true }).fill("Sawah Subang");
  await page.getByRole("button", { name: "Simpan lahan", exact: true }).click();
  await expect(page.getByRole("article", { name: "Sawah Subang" })).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("agri:workspace:v2")!).farms.find((f: {nama:string}) => f.nama === "Sawah Subang"));
  expect(after.id).toBe(before.id);
  expect(after.dibuatPada).toBe(before.dibuatPada);
  await page.reload();
  await expect(page.getByRole("article", { name: "Sawah Subang" })).toBeVisible();
});

test("klinik Pages bekerja tanpa API", async ({ page }) => {
  await page.goto(base);
  await page.getByRole("link", { name: /Klinik tanaman/ }).click();
  await expect(page.getByRole("heading", { name: /Tanaman terpantau/ })).toBeVisible();
  await expect(page.getByText("Analisis AI", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Simpan catatan", exact: true })).toBeEnabled();
  await page.getByLabel("Catatan gejala", { exact: true }).fill("Daun bawah menguning");
  await page.getByRole("button", { name: "Simpan catatan" }).click();
  await page.reload();
  await expect(page.getByLabel("Riwayat pengamatan")).toContainText("Daun bawah menguning");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole("link", { name: /Kembali ke lahan saya/ }).click();
  await expect(page.getByRole("button", { name: "Coba dengan 3 lahan contoh" })).toBeVisible();
});

test("buku kas dan riwayat penyakit berjalan lokal serta ikut cadangan", async ({ page }) => {
  const apiCalls: string[] = [];page.on("request",r=>{if(r.url().includes("/api/"))apiCalls.push(r.url());});
  await page.goto(base);await page.getByRole("button",{name:"Coba dengan 3 lahan contoh"}).click();
  await page.getByRole("link",{name:/Buku kas tani/}).click();
  await expect(page.getByRole("button",{name:"Simpan harga produk"})).toBeEnabled();
  await page.getByLabel("Nama produk harga",{exact:true}).fill("Produk uji cair");
  await page.getByLabel("Isi kemasan",{exact:true}).fill("1000");
  await page.getByLabel("Harga kemasan (Rp)",{exact:true}).fill("150000");
  await page.getByRole("button",{name:"Simpan harga produk"}).click();
  await page.getByRole("combobox",{name:"Lahan transaksi",exact:true}).selectOption({label:"Lahan Jagung A"});
  await page.getByLabel("Jumlah dipakai (ml)",{exact:true}).fill("320");
  await page.getByRole("button",{name:"Simpan transaksi"}).click();
  await expect(page.getByLabel("Transaksi tercatat",{exact:true})).toContainText("48.000");
  await page.getByRole("combobox",{name:"Jenis transaksi",exact:true}).selectOption("income");
  await page.getByLabel("Jumlah rupiah",{exact:true}).fill("96000");
  await page.getByRole("button",{name:"Simpan transaksi"}).click();
  await expect(page.getByText("100%",{exact:true}).first()).toBeVisible();
  await page.reload();await expect(page.getByText("100%",{exact:true}).first()).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:"output/ui-review/finance-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:"output/ui-review/finance-mobile.png",fullPage:true});
  await page.getByRole("link",{name:"Riwayat penyakit",exact:true}).click();
  await expect(page.getByRole("button",{name:"Simpan pengamatan"})).toBeEnabled();
  await page.getByRole("combobox",{name:"Lahan pengamatan",exact:true}).selectOption({label:"Lahan Jagung A"});
  for(const symptom of ["Bercak daun","bercak daun"]){await page.getByLabel("Gejala atau nama penyakit",{exact:true}).fill(symptom);await page.getByRole("button",{name:"Simpan pengamatan"}).click();await expect(page.getByLabel("Gejala atau nama penyakit",{exact:true})).toHaveValue("");}
  await expect(page.getByLabel("Frekuensi per lahan",{exact:true})).toContainText("2 catatan");
  await expect(page.getByLabel("Frekuensi per lahan",{exact:true})).toContainText("Manual 2");
  await page.reload();await expect(page.getByLabel("Frekuensi per lahan",{exact:true})).toContainText("2 catatan");
  await page.screenshot({path:"output/ui-review/disease-mobile.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole("combobox",{name:"Filter lahan",exact:true}).selectOption({label:"Lahan Padi B"});
  await expect(page.getByLabel("Frekuensi per lahan",{exact:true})).toContainText("Belum ada pola");
  await page.getByRole("link",{name:/Lahan saya/}).click();
  const backup=await page.evaluate(()=>localStorage.getItem("agri:workspace:v2")!);
  expect(JSON.parse(backup).records.cash).toHaveLength(2);expect(JSON.parse(backup).records.diseases).toHaveLength(2);
  await page.getByLabel("File cadangan").setInputFiles({name:"restore.json",mimeType:"application/json",buffer:Buffer.from(backup)});
  await page.getByRole("button",{name:"Ganti data dengan cadangan ini"}).click();
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem("agri:workspace:v2")!)).records.cash).toHaveLength(2);
  expect(apiCalls).toEqual([]);
});

test("buku kas menolak jumlah invalid dan kegagalan penyimpanan",async({page})=>{
  await page.goto(base);await page.getByRole("button",{name:"Coba dengan 3 lahan contoh"}).click();
  await page.getByRole("link",{name:/Buku kas tani/}).click();
  await page.getByRole("button",{name:"Simpan transaksi"}).click();
  await expect(page.locator("p[role=alert]")).toContainText("Pilih harga produk");
  await page.getByRole("combobox",{name:"Jenis transaksi",exact:true}).selectOption("income");
  await page.getByLabel("Jumlah rupiah",{exact:true}).fill("-1");await page.getByRole("button",{name:"Simpan transaksi"}).click();
  await expect(page.locator("p[role=alert]")).toContainText("rupiah");
  await page.getByLabel("Jumlah rupiah",{exact:true}).fill("100000");
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException("Full","QuotaExceededError");};});
  await page.getByRole("button",{name:"Simpan transaksi"}).click();
  await expect(page.locator("p[role=alert]")).toContainText("belum tersimpan");
  await expect(page.getByLabel("Transaksi tercatat",{exact:true})).toContainText("Belum ada transaksi");
});

test("kalkulator membawa total produk tanpa otomatis membebankan biaya",async({page})=>{
  await page.goto(base);await page.getByRole("button",{name:"Coba dengan 3 lahan contoh"}).click();
  await page.getByRole("navigation",{name:"Menu utama"}).getByRole("button",{name:/Kalkulator dosis/}).click();
  await page.getByLabel("Produk Bayer").selectOption("nativo");
  await page.getByLabel("Luas lahan (hektare)",{exact:true}).fill("1");
  await page.getByLabel("Kapasitas tangki (liter)").fill("15");
  await page.getByLabel("Dosis produk (gram/ha)").fill("400");
  await page.getByLabel("Air per hektare (liter/ha)").fill("200");
  await page.getByRole("button",{name:"Hitung campuran",exact:true}).click();
  await page.getByRole("button",{name:"Catat biaya di Buku Kas"}).click();
  await expect(page.getByText(/Dari kalkulator:/)).toContainText("400 g");
  await expect(page.getByLabel("Jumlah dipakai (ml / gram)",{exact:true})).toHaveValue("400");
  await expect(page.getByLabel("Transaksi tercatat",{exact:true})).toContainText("Belum ada transaksi");
});

test("sidebar stays reachable on short screens and retains large touch targets",async({page})=>{
  await page.setViewportSize({width:1366,height:768});await page.goto(base);
  await expect(page.getByRole("button",{name:"Coba dengan 3 lahan contoh"})).toBeVisible();
  await page.screenshot({path:"output/ui-review/sidebar-desktop.png"});
  for(const height of [600,420]){
    await page.setViewportSize({width:1024,height});
    const footer=page.getByRole("link",{name:/Panduan produk/});
    const footerBox=await footer.boundingBox();expect(footerBox!.y).toBeGreaterThanOrEqual(0);expect(footerBox!.y+footerBox!.height).toBeLessThanOrEqual(height);
    await page.getByRole("button",{name:/Lahan saya/}).focus();
    const last=page.getByRole("link",{name:/Riwayat penyakit/});await last.focus();
    const bounds=await last.boundingBox();const scroll=await page.locator('.sidebar-scroll').boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(scroll!.y-1);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(scroll!.y+scroll!.height+1);
    expect(bounds!.height).toBeGreaterThanOrEqual(64);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  await page.screenshot({path:"output/ui-review/sidebar-short.png"});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:"output/ui-review/sidebar-mobile.png"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole("button",{name:/Jadwal tanam/}).click();
  await expect(page.getByRole("button",{name:/Jadwal tanam/})).toHaveAttribute("aria-pressed","true");
});
