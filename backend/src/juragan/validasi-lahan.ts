import type { MasukanLahan } from "@agri/contracts";
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

