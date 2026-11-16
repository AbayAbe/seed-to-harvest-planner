import type { CuacaLahan } from "@agri/contracts";
import { HttpError } from "../http-error.js";

export type FetchCuaca = (url: URL, init?: RequestInit) => Promise<Response>;
/** Transport palsu bergaya OpenWeather: tidak ada permintaan internet/API key. */
export const fetchCuacaSimulasi: FetchCuaca = async (url, init) => {
  init?.signal?.throwIfAborted();
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const variasi = (Math.abs(Math.round(lat * 1000)) + Math.abs(Math.round(lon * 1000))) % 3;
  const kondisi = ["Rain", "Clouds", "Clear"][variasi];
  const waktu = Math.floor(Date.now() / 1000);
  const payload = url.pathname.endsWith("/forecast")
    ? { list: [{ dt: waktu + 3 * 3600, pop: [0.85, 0.5, 0.15][variasi] }] }
    : { coord: { lat, lon }, weather: [{ main: kondisi }], main: { temp: [26, 27, 31][variasi] }, dt: waktu };
  return Response.json(payload);
};

/** Selalu memakai koordinat lahan; tidak pernah membaca navigator.geolocation. */
export async function ambilCuacaLahan(latitude: number, longitude: number, fetcher: FetchCuaca = fetchCuacaSimulasi): Promise<CuacaLahan> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new HttpError(400, "KOORDINAT_INVALID", "Koordinat lahan tidak valid.");
  }
  const url = (endpoint: string) => {
    const value = new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
    value.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), units: "metric", lang: "id", cnt: "1" }).toString();
    return value;
  };
  try {
    const signal = AbortSignal.timeout(8_000);
    const responses = await Promise.all([fetcher(url("weather"), { signal }), fetcher(url("forecast"), { signal })]);
    if (responses.some((response) => !response.ok)) throw new Error("Penyedia cuaca gagal.");
    const [current, forecast] = await Promise.all(responses.map((response) => response.json()));
    const condition: unknown = current?.weather?.[0]?.main;
    const pop: unknown = forecast?.list?.[0]?.pop;
    const forecastTime: unknown = forecast?.list?.[0]?.dt;
    if (!["Rain", "Drizzle", "Thunderstorm", "Clear", "Clouds"].includes(String(condition))
      || typeof current?.main?.temp !== "number" || !Number.isFinite(current.main.temp)
      || typeof pop !== "number" || !Number.isFinite(pop) || pop < 0 || pop > 1
      || typeof forecastTime !== "number" || !Number.isFinite(forecastTime)
      || typeof current?.dt !== "number" || !Number.isFinite(current.dt)
      || current?.coord?.lat !== latitude || current?.coord?.lon !== longitude) throw new Error("Data cuaca tidak lengkap.");
    const hujan = ["Rain", "Drizzle", "Thunderstorm"].includes(String(condition));
    return { latitude, longitude, status: hujan ? "Hujan" : condition === "Clear" ? "Cerah" : "Berawan",
      ikon: hujan ? "cloud-rain" : condition === "Clear" ? "sun" : "cloud-sun",
      suhuCelsius: current.main.temp, potensiHujanPersen: Math.round(pop * 100),
      waktuPrakiraan: new Date(forecastTime * 1000).toISOString(),
      diperbaruiPada: new Date(current.dt * 1000).toISOString(), sumber: "simulasi" };
  } catch { throw new HttpError(502, "CUACA_GAGAL", "Cuaca lahan belum tersedia. Coba muat lagi sebelum menentukan penyemprotan."); }
}

/** Cache satu menit per koordinat; galat tidak disimpan atau diganti menjadi cerah. */
export function buatLayananCuaca(fetcher: FetchCuaca = fetchCuacaSimulasi, now = Date.now) {
  const cache = new Map<string, { until: number; data: CuacaLahan }>();
  return async (latitude: number, longitude: number) => {
    const key = `${latitude},${longitude}`;
    const hit = cache.get(key);
    if (hit && hit.until > now()) return hit.data;
    const data = await ambilCuacaLahan(latitude, longitude, fetcher);
    if (cache.size >= 1000) cache.clear();
    cache.set(key, { until: now() + 60_000, data });
    return data;
  };
}
