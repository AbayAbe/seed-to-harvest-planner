import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Lahan, MasukanLahan, Pengguna } from "@agri/contracts";
import { SKEMA_JURAGAN } from "./skema.js";
import { SEED_VARIETIES } from "../lib/planner/seed-data.js";
import { parseCalendarDate } from "../lib/planner/dates.js";
import { HttpError } from "../http-error.js";

export function validasiLahan(body: Record<string, unknown>): MasukanLahan {
  const keys = ["nama", "lokasi", "luasHektare", "latitude", "longitude", "seedId", "tanggalTanam"];
  if (Object.keys(body).some((key) => !keys.includes(key))) throw new HttpError(400, "ISIAN_LAHAN", "Ada isian lahan yang tidak dikenal.");
  for (const key of ["nama", "lokasi"] as const) {
    if (typeof body[key] !== "string" || !body[key].trim() || body[key].trim().length > 100) {
      throw new HttpError(400, "ISIAN_LAHAN", "Isi nama dan lokasi lahan, maksimal 100 huruf.");
    }
  }
  if (typeof body.luasHektare !== "number" || !Number.isFinite(body.luasHektare) || body.luasHektare <= 0 || body.luasHektare > 1_000_000) {
    throw new HttpError(400, "ISIAN_LAHAN", "Luas lahan harus lebih dari nol dan paling besar 1.000.000 hektare.");
  }
  for (const [key, batas] of [["latitude", 90], ["longitude", 180]] as const) {
    if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || Math.abs(body[key]) > batas) {
      throw new HttpError(400, "KOORDINAT_INVALID", "Koordinat lahan tidak valid. Periksa lintang dan bujur.");
    }
  }
  if (typeof body.seedId !== "string" || !SEED_VARIETIES.some((seed) => seed.id === body.seedId)) {
    throw new HttpError(400, "ISIAN_LAHAN", "Pilih jenis tanaman yang tersedia.");
  }
  try { parseCalendarDate(body.tanggalTanam as string); }
  catch { throw new HttpError(400, "ISIAN_LAHAN", "Isi tanggal tanam yang valid."); }
  return {
    nama: (body.nama as string).trim(), lokasi: (body.lokasi as string).trim(),
    luasHektare: body.luasHektare, latitude: body.latitude as number, longitude: body.longitude as number,
    seedId: body.seedId, tanggalTanam: body.tanggalTanam as string,
  };
}

export class DatabaseJuragan {
  private readonly db: DatabaseSync;
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(SKEMA_JURAGAN);
  }
  tutup() { this.db.close(); }
  penggunaUntukNomor(nomorHp: string, now: number): Pengguna {
    const lama = this.db.prepare("SELECT * FROM pengguna WHERE nomorHp = ?").get(nomorHp);
    if (lama) return lama as unknown as Pengguna;
    const pengguna: Pengguna = { id: randomUUID(), nomorHp, nama: "Pemilik lahan", dibuatPada: new Date(now).toISOString() };
    this.db.prepare("INSERT INTO pengguna VALUES (?, ?, ?, ?)").run(pengguna.id, nomorHp, pengguna.nama, pengguna.dibuatPada);
    return pengguna;
  }
  buatSesi(hashToken: string, penggunaId: string, berlakuSampai: number, now: number) {
    this.db.prepare("DELETE FROM sesi WHERE berlakuSampai <= ?").run(now);
    this.db.prepare("INSERT INTO sesi VALUES (?, ?, ?)").run(hashToken, penggunaId, berlakuSampai);
  }
  penggunaDariSesi(hashToken: string, now: number): Pengguna | null {
    return (this.db.prepare("SELECT p.* FROM pengguna p JOIN sesi s ON p.id = s.penggunaId WHERE s.hashToken = ? AND s.berlakuSampai > ?").get(hashToken, now) as unknown as Pengguna | undefined) ?? null;
  }
  hapusSesi(hashToken: string) { this.db.prepare("DELETE FROM sesi WHERE hashToken = ?").run(hashToken); }
  daftarLahan(penggunaId: string): Lahan[] {
    return this.db.prepare("SELECT * FROM lahan WHERE penggunaId = ? ORDER BY dibuatPada, rowid").all(penggunaId) as unknown as Lahan[];
  }
  lahanMilik(penggunaId: string, id: string): Lahan {
    const lahan = this.db.prepare("SELECT * FROM lahan WHERE penggunaId = ? AND id = ?").get(penggunaId, id);
    if (!lahan) throw new HttpError(404, "LAHAN_TIDAK_ADA", "Lahan tidak ditemukan.");
    return lahan as unknown as Lahan;
  }
  tambahLahan(penggunaId: string, data: MasukanLahan, now: number): Lahan {
    const id = randomUUID();
    const hariPanen = SEED_VARIETIES.find((seed) => seed.id === data.seedId)!.phases.find((phase) => phase.type === "harvest")!.dayOffset;
    const lahan: Lahan = { ...data, id, penggunaId, hariPanen, topikMqtt: `juragan/${penggunaId}/lahan/${id}/cuaca`, dibuatPada: new Date(now).toISOString() };
    this.db.prepare("INSERT INTO lahan VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, penggunaId, data.nama, data.lokasi, data.luasHektare, data.latitude, data.longitude,
      data.seedId, data.tanggalTanam, hariPanen, lahan.topikMqtt, lahan.dibuatPada,
    );
    return lahan;
  }
  tambahContoh(penggunaId: string, now: number): Lahan[] {
    // Transaksi membuat tombol contoh aman ditekan ulang tanpa menggandakan lahan.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (!this.daftarLahan(penggunaId).length) {
        const contoh: MasukanLahan[] = [
          { nama: "Lahan Jagung A", lokasi: "Garut", luasHektare: 2.5, latitude: -7.215, longitude: 107.901, seedId: "dekalb-dk771-corn", tanggalTanam: "2026-11-01" },
          { nama: "Lahan Padi B", lokasi: "Subang", luasHektare: 4.2, latitude: -6.571, longitude: 107.758, seedId: "padi-demo", tanggalTanam: "2026-11-08" },
          { nama: "Lahan Cabai C", lokasi: "Lembang", luasHektare: 0.8, latitude: -6.817, longitude: 107.616, seedId: "cabai-demo", tanggalTanam: "2026-11-05" },
        ];
        for (const data of contoh) this.tambahLahan(penggunaId, data, now);
      }
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.daftarLahan(penggunaId);
  }
}
