import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Lahan, TantanganOtp } from "@agri/contracts";
import { createApiServer } from "../backend/src/app";
import { DatabaseJuragan } from "../backend/src/juragan/database";
import { normalisasiNomorHp } from "../backend/src/juragan/otp";
import { ambilCuacaLahan, buatLayananCuaca, fetchCuacaSimulasi, type FetchCuaca } from "../backend/src/juragan/cuaca";

let now = Date.now();
const server = createApiServer({ now: () => now });
let base: string;
let nomorUrut = 1000;
before(async () => {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
function post(path: string, body: unknown, cookie = "", origin?: string) {
  return fetch(`${base}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
}
async function tantangan(nomorHp = `08123456${nomorUrut++}`): Promise<TantanganOtp> {
  const response = await post("auth/request-otp", { nomorHp, kanal: "whatsapp" });
  assert.equal(response.status, 200);
  return response.json();
}
async function masuk() {
  const kode = await tantangan();
  const response = await post("auth/verify-otp", { id: kode.id, kode: kode.kodeSimulasi });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  const body = await response.json();
  assert.ok(!("token" in body));
  return { cookie: cookie.split(";")[0]!, pengguna: body.pengguna };
}
test("nomor lokal dan internasional dinormalisasi tanpa menerima nomor sembarang", () => {
  assert.equal(normalisasiNomorHp("0812 3456 7890"), "+6281234567890");
  assert.equal(normalisasiNomorHp("+62 812-3456-7890"), "+6281234567890");
  for (const input of ["", "123", "+14155552671", "08123abc45678", 8123456]) assert.throws(() => normalisasiNomorHp(input));
});
test("lahan memerlukan sesi dan OTP hanya dapat dipakai satu kali", async () => {
  assert.equal((await fetch(`${base}/api/lahan`)).status, 401);
  assert.equal((await (await fetch(`${base}/api/auth/session`)).json()).pengguna, null);
  const kode = await tantangan();
  assert.match(kode.kodeSimulasi, /^\d{6}$/);
  assert.equal(kode.mode, "simulasi");
  assert.equal((await post("auth/verify-otp", { id: kode.id, kode: kode.kodeSimulasi })).status, 200);
  assert.equal((await post("auth/verify-otp", { id: kode.id, kode: kode.kodeSimulasi })).status, 400);
});
test("kode salah, kedaluwarsa, batas percobaan, dan jeda kirim ulang ditegakkan server", async () => {
  const nomorHp = `08123456${nomorUrut++}`;
  const kode = await tantangan(nomorHp);
  assert.equal((await post("auth/request-otp", { nomorHp, kanal: "sms" })).status, 429);
  const salah = kode.kodeSimulasi === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await post("auth/verify-otp", { id: kode.id, kode: salah })).status, 400);
  assert.equal((await post("auth/verify-otp", { id: kode.id, kode: kode.kodeSimulasi })).status, 400);
  const expired = await tantangan();
  now += 5 * 60_000 + 1;
  assert.equal((await post("auth/verify-otp", { id: expired.id, kode: expired.kodeSimulasi })).status, 400);
  const lama = await tantangan();
  now += 60_001;
  // Setelah nomor yang sama meminta kode baru, kode lamanya tidak berlaku.
  const nomorLama = `08123456${nomorUrut - 1}`;
  await tantangan(nomorLama);
  assert.equal((await post("auth/verify-otp", { id: lama.id, kode: lama.kodeSimulasi })).status, 400);
});
test("pemilik hanya dapat membaca lahannya dan cuaca koordinat lahannya sendiri", async () => {
  const a = await masuk();
  const b = await masuk();
  const farms: { lahan: Lahan[] } = await (await post("lahan/contoh", {}, a.cookie)).json();
  assert.equal(farms.lahan.length, 3);
  assert.ok(farms.lahan.every((farm) => farm.penggunaId === a.pengguna.id && farm.topikMqtt?.includes(farm.id)));
  assert.equal((await (await post("lahan/contoh", {}, a.cookie)).json()).lahan.length, 3);
  assert.equal((await (await fetch(`${base}/api/lahan`, { headers: { Cookie: b.cookie } })).json()).lahan.length, 0);
  const garut = farms.lahan[0]!;
  assert.equal((await fetch(`${base}/api/lahan/${garut.id}/cuaca`, { headers: { Cookie: b.cookie } })).status, 404);
  const weather = await (await fetch(`${base}/api/lahan/${garut.id}/cuaca`, { headers: { Cookie: a.cookie } })).json();
  assert.equal(weather.latitude, garut.latitude);
  assert.equal(weather.longitude, garut.longitude);
  assert.equal(weather.status, "Hujan");
  const newFarm = { nama: "Sawah baru", lokasi: "Subang", luasHektare: 1.5, latitude: -6.571, longitude: 107.758, seedId: "padi-demo", tanggalTanam: "2026-11-16" };
  assert.equal((await post("lahan", { ...newFarm, penggunaId: a.pengguna.id }, b.cookie)).status, 400);
  assert.equal((await post("lahan", { ...newFarm, latitude: 91 }, b.cookie)).status, 400);
  assert.equal((await post("lahan", { ...newFarm, longitude: -181 }, b.cookie)).status, 400);
  assert.equal((await post("lahan", { ...newFarm, luasHektare: 0 }, b.cookie)).status, 400);
  assert.equal((await post("lahan", { ...newFarm, tanggalTanam: "2026-02-30" }, b.cookie)).status, 400);
  const created = await post("lahan", newFarm, b.cookie);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).penggunaId, b.pengguna.id);
});
test("keluar, sesi kedaluwarsa, dan origin asing tidak dapat memakai aset", async () => {
  const session = await masuk();
  assert.equal((await post("auth/logout", {}, session.cookie)).status, 200);
  assert.equal((await fetch(`${base}/api/lahan`, { headers: { Cookie: session.cookie } })).status, 401);
  const expiring = await masuk();
  now += 8 * 3600_000 + 1;
  assert.equal((await fetch(`${base}/api/lahan`, { headers: { Cookie: expiring.cookie } })).status, 401);
  assert.equal((await post("auth/request-otp", { nomorHp: "081234567890", kanal: "sms" }, "", "https://asing.example")).status, 403);
});
test("database menyimpan relasi pengguna-lahan setelah dibuka ulang", () => {
  const folder = mkdtempSync(join(tmpdir(), "agri-juragan-test-"));
  const path = join(folder, "test.sqlite");
  let db = new DatabaseJuragan(path);
  try {
    const user = db.penggunaUntukNomor("+6281234567890", now);
    const farms = db.tambahContoh(user.id, now);
    db.tutup();
    db = new DatabaseJuragan(path);
    assert.equal(db.penggunaUntukNomor(user.nomorHp, now).id, user.id);
    assert.deepEqual(db.daftarLahan(user.id), farms);
  } finally {
    db.tutup();
    for (const suffix of ["", "-shm", "-wal"]) rmSync(path + suffix, { force: true });
    rmdirSync(folder);
  }
});
test("cuaca memanggil provider dengan lat/lon lahan dan memisahkan peluang hujan", async () => {
  const calls: URL[] = [];
  const fetcher: FetchCuaca = async (url, options) => { calls.push(url); return fetchCuacaSimulasi(url, options); };
  const garut = await ambilCuacaLahan(-7.215, 107.901, fetcher);
  const subang = await ambilCuacaLahan(-6.571, 107.758, fetcher);
  assert.equal(garut.status, "Hujan");
  assert.equal(garut.ikon, "cloud-rain");
  assert.equal(garut.potensiHujanPersen, 85);
  assert.equal(subang.status, "Cerah");
  assert.equal(calls.length, 4);
  assert.equal(calls[0]!.searchParams.get("lat"), "-7.215");
  assert.equal(calls[0]!.searchParams.get("lon"), "107.901");
  assert.equal(calls[2]!.searchParams.get("lat"), "-6.571");
  assert.equal(calls[2]!.searchParams.get("lon"), "107.758");
  await assert.rejects(() => ambilCuacaLahan(NaN, 107));
  await assert.rejects(() => ambilCuacaLahan(-7, 181));
});
test("cuaca gagal atau data kosong tidak berubah menjadi cerah; cache terpisah per koordinat", async () => {
  for (const fetcher of [async () => Response.json({}, { status: 503 }), async () => Response.json({}), async () => { throw new Error("offline"); }]) {
    await assert.rejects(() => ambilCuacaLahan(-7.215, 107.901, fetcher), /belum tersedia/);
  }
  let calls = 0;
  let time = 0;
  const service = buatLayananCuaca(async (url, options) => { calls++; return fetchCuacaSimulasi(url, options); }, () => time);
  await service(-7.215, 107.901); await service(-7.215, 107.901);
  assert.equal(calls, 2);
  await service(-6.571, 107.758);
  assert.equal(calls, 4);
  time = 60_001;
  await service(-7.215, 107.901);
  assert.equal(calls, 6);
});
