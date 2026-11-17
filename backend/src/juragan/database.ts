import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Lahan, MasukanLahan, Pengguna } from "@agri/contracts";
import { SKEMA_JURAGAN } from "./skema.js";
import { SEED_VARIETIES } from "../lib/planner/seed-data.js";
import { HttpError } from "../http-error.js";
import { RecordsRepository } from "../records/repository.js";

export { validasiLahan } from "./validasi-lahan.js";

export class DatabaseJuragan {
  private readonly db: DatabaseSync;
  readonly records: RecordsRepository;
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(SKEMA_JURAGAN);
    this.records = new RecordsRepository(this.db);
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
