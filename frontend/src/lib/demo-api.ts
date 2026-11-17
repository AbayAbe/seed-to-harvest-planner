import type { Lahan, MasukanLahan, Pengguna, TankMixForm, TimelineRequest } from "@agri/contracts";
import { SEED_VARIETIES } from "../../../backend/src/lib/planner/seed-data";
import { WEATHER_SCENARIOS, createScenarioWeather } from "../../../backend/src/lib/planner/scenarios";
import { generateTimelineReport } from "../../../backend/src/lib/planner/timeline";
import { PRODUCT_CATALOG } from "../../../backend/src/lib/tank-mix/catalog";
import { evaluateTankMix } from "../../../backend/src/lib/tank-mix/form";
import { validasiLahan } from "../../../backend/src/juragan/validasi-lahan";
import { ambilCuacaLahan } from "../../../backend/src/juragan/cuaca";

const DATA_KEY = "agri:pages:lahan:v1";
const pengguna: Pengguna = { id: "demo-browser", nama: "Pemilik lahan", nomorHp: "Nomor contoh", dibuatPada: "2026-01-01T00:00:00.000Z" };

/** Demo lokal, bukan autentikasi. Tidak mengirim nomor HP atau data lahan ke server. */
function readFarms(): Lahan[] {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error();
    for (const item of parsed) {
      if (!item || typeof item.id !== "string" || item.penggunaId !== pengguna.id) throw new Error();
      validasiLahan({ nama: item.nama, lokasi: item.lokasi, luasHektare: item.luasHektare,
        latitude: item.latitude, longitude: item.longitude, seedId: item.seedId, tanggalTanam: item.tanggalTanam });
    }
    return parsed as Lahan[];
  } catch { throw new Error("Data di browser belum bisa dibaca. Izinkan penyimpanan situs. Data lama tidak dihapus otomatis."); }
}
function saveFarms(farms: Lahan[]) {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(farms)); }
  catch { throw new Error("Lahan belum tersimpan. Penyimpanan browser penuh atau diblokir. Izinkan penyimpanan situs lalu coba lagi."); }
}
function makeFarm(data: MasukanLahan): Lahan {
  const id = crypto.randomUUID();
  const hariPanen = SEED_VARIETIES.find(seed => seed.id === data.seedId)!.phases.find(phase => phase.type === "harvest")!.dayOffset;
  return { ...data, id, penggunaId: pengguna.id, hariPanen, topikMqtt: null, dibuatPada: new Date().toISOString() };
}
/** Adapter untuk versi GitHub Pages; rumus dan katalog memakai modul yang sama dengan backend. */
export async function requestDemo(path: string, body?: string): Promise<unknown> {
  path = path.split("?")[0]!;
  if (path === "auth/session") return { pengguna, mode: "simulasi" };
  if (path === "catalog") return { seeds: SEED_VARIETIES, products: PRODUCT_CATALOG, scenarios: WEATHER_SCENARIOS };
  if (path === "lahan" && body === undefined) return { lahan: readFarms() };
  if (path === "lahan/contoh") {
    let farms = readFarms();
    if (!farms.length) {
      const today = new Date();
      const tanggalTanam = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      farms = [
        { nama: "Lahan Jagung A", lokasi: "Garut", luasHektare: 2.5, latitude: -7.215, longitude: 107.901, seedId: "dekalb-dk771-corn", tanggalTanam },
        { nama: "Lahan Padi B", lokasi: "Subang", luasHektare: 4.2, latitude: -6.571, longitude: 107.758, seedId: "padi-demo", tanggalTanam },
        { nama: "Lahan Cabai C", lokasi: "Lembang", luasHektare: 0.8, latitude: -6.817, longitude: 107.616, seedId: "cabai-demo", tanggalTanam },
      ].map(makeFarm);
      saveFarms(farms);
    }
    return { lahan: farms };
  }
  if (path === "lahan" && body !== undefined) {
    const farm = makeFarm(validasiLahan(JSON.parse(body)));
    saveFarms([...readFarms(), farm]);
    return farm;
  }
  const weather = path.match(/^lahan\/([^/]+)\/cuaca$/);
  if (weather) {
    const farm = readFarms().find(item => item.id === weather[1]);
    if (!farm) throw new Error("Lahan tidak ditemukan.");
    return ambilCuacaLahan(farm.latitude, farm.longitude);
  }
  if (path === "timeline" && body) {
    const data = JSON.parse(body) as TimelineRequest;
    return generateTimelineReport(data.seedId, data.startDate, {
      weatherProvider: createScenarioWeather(data.scenario, data.startDate), harvestDayOffset: data.harvestDayOffset,
    });
  }
  if (path === "tank-mix" && body) {
    const result = evaluateTankMix(JSON.parse(body) as TankMixForm);
    if (!result.result) throw Object.assign(new Error("Periksa kembali isian perhitungan."), { fields: result.errors });
    return result.result;
  }
  throw new Error("Fitur ini belum tersedia.");
}
