import type { Lahan } from "@agri/contracts";
import { validasiLahan } from "../../../backend/src/juragan/validasi-lahan";
import { parseCalendarDate } from "../../../backend/src/lib/planner/dates";
import { validateRecords } from "../../../backend/src/records/domain";
import type { FarmRecords } from "@agri/contracts";

export const WORKSPACE_KEY = "agri:workspace:v2";
export interface Kegiatan {
  id: string; lahanId: string; judul: string; tanggal: string; catatan: string;
  biaya: number; selesai: boolean;
}
export interface Workspace { version: 2; farms: Lahan[]; kegiatan: Kegiatan[]; records: FarmRecords }
const fail = () => { throw new Error("Isi cadangan tidak valid. Data Anda belum diubah."); };
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }

/** Validasi impor sebelum satu penulisan atomik. Cadangan tidak pernah dieksekusi sebagai kode. */
export function validateWorkspace(raw: unknown): Workspace {
  if (!raw || typeof raw !== "object") return fail();
  const data = raw as Workspace;
  if (data.version !== 2 || !Array.isArray(data.farms) || !Array.isArray(data.kegiatan)
    || data.farms.length > 1000 || data.kegiatan.length > 10000) return fail();
  const ids = new Set<string>();
  const farms = data.farms.map(farm => {
    if (!farm || !text(farm.id, 100) || !farm.id || ids.has(farm.id)) return fail();
    ids.add(farm.id);
    const input = validasiLahan({ nama: farm.nama, lokasi: farm.lokasi, luasHektare: farm.luasHektare,
      seedId: farm.seedId, tanggalTanam: farm.tanggalTanam, latitude: farm.latitude, longitude: farm.longitude });
    if (!text(farm.dibuatPada, 50) || !Number.isFinite(Date.parse(farm.dibuatPada))) return fail();
    if (!Number.isInteger(farm.hariPanen) || farm.hariPanen < 1 || farm.hariPanen > 3660) return fail();
    return { ...input, id: farm.id, penggunaId: "demo-browser", topikMqtt: null,
      hariPanen: farm.hariPanen, dibuatPada: farm.dibuatPada } satisfies Lahan;
  });
  const activityIds = new Set<string>();
  const kegiatan = data.kegiatan.map(item => {
    if (!item || !text(item.id, 100) || !item.id || activityIds.has(item.id) || !ids.has(item.lahanId)
      || !text(item.judul, 120) || !item.judul.trim() || !text(item.catatan, 1000)
      || !Number.isFinite(item.biaya) || item.biaya < 0 || item.biaya > 1e12 || typeof item.selesai !== "boolean") return fail();
    parseCalendarDate(item.tanggal);
    activityIds.add(item.id);
    return { id: item.id, lahanId: item.lahanId, judul: item.judul.trim(), catatan: item.catatan,
      tanggal: item.tanggal, biaya: item.biaya, selesai: item.selesai };
  });
  return { version: 2, farms, kegiatan, records: validateRecords(data.records, ids) };
}
export function readWorkspace(): Workspace {
  try {
    const current = localStorage.getItem(WORKSPACE_KEY);
    if (current !== null) return validateWorkspace(JSON.parse(current));
    const legacy = localStorage.getItem("agri:pages:lahan:v1");
    return validateWorkspace({ version: 2, farms: legacy ? JSON.parse(legacy) : [], kegiatan: [] });
  } catch { throw new Error("Data di browser belum bisa dibaca. Data lama tidak dihapus. Periksa penyimpanan situs atau pulihkan cadangan yang valid."); }
}
export function writeWorkspace(data: Workspace) {
  const valid = validateWorkspace(data);
  try { const json = JSON.stringify(valid); if (new Blob([json]).size > 2_000_000) throw new Error("capacity"); localStorage.setItem(WORKSPACE_KEY, json); }
  catch { throw new Error("Lahan belum tersimpan. Penyimpanan browser penuh atau diblokir. Unduh cadangan sebelum mengosongkan penyimpanan."); }
}
export function parseBackup(raw: string): Workspace {
  if (raw.length > 2_000_000) throw new Error("Ukuran cadangan maksimal 2 MB.");
  try { return validateWorkspace(JSON.parse(raw)); }
  catch { return fail(); }
}
