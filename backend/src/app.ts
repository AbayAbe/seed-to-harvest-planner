import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ApiErrorResponse, CatalogResponse, TankMixForm, WeatherScenarioId } from "@agri/contracts";
import { SEED_VARIETIES } from "./lib/planner/seed-data.js";
import { WEATHER_SCENARIOS, createScenarioWeather } from "./lib/planner/scenarios.js";
import { generateTimelineReport } from "./lib/planner/timeline.js";
import { PRODUCT_CATALOG } from "./lib/tank-mix/catalog.js";
import { evaluateTankMix } from "./lib/tank-mix/form.js";
import { HttpError } from "./http-error.js";
import { DatabaseJuragan, validasiLahan } from "./juragan/database.js";
import { cookieSesi, LayananOtp } from "./juragan/otp.js";
import { buatLayananCuaca, type FetchCuaca } from "./juragan/cuaca.js";

const BODY_LIMIT = 16 * 1024;
function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(payload));
}
function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Kirim data dalam format JSON.");
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        chunks.length = 0;
        reject(new HttpError(413, "BODY_TOO_LARGE", "Data yang dikirim terlalu besar."));
      } else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("aborted", () => reject(new HttpError(400, "REQUEST_ABORTED", "Permintaan dibatalkan.")));
    req.on("end", () => {
      if (size > BODY_LIMIT) return;
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
        resolve(body as Record<string, unknown>);
      } catch { reject(new HttpError(400, "INVALID_JSON", "Isi permintaan harus berupa objek JSON yang valid.")); }
    });
  });
}
function exactKeys(body: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(body).some((key) => !keys.includes(key))) {
    throw new HttpError(400, "INVALID_INPUT", "Ada nama isian yang tidak dikenal.");
  }
}
function timeline(body: Record<string, unknown>) {
  exactKeys(body, ["seedId", "startDate", "scenario", "harvestDayOffset"]);
  if (typeof body.seedId !== "string" || !SEED_VARIETIES.some((seed) => seed.id === body.seedId)) {
    throw new HttpError(400, "INVALID_INPUT", "Pilih tanaman yang tersedia.");
  }
  if (typeof body.startDate !== "string") throw new HttpError(400, "INVALID_INPUT", "Isi tanggal tanam yang valid.");
  if (typeof body.scenario !== "string" || !WEATHER_SCENARIOS.some((scenario) => scenario.id === body.scenario)) {
    throw new HttpError(400, "INVALID_INPUT", "Pilih skenario cuaca yang tersedia.");
  }
  if (typeof body.harvestDayOffset !== "number" || !Number.isSafeInteger(body.harvestDayOffset) || body.harvestDayOffset < 1) {
    throw new HttpError(400, "INVALID_INPUT", "Isi hari panen dengan bilangan bulat lebih dari nol.");
  }
  try {
    return generateTimelineReport(body.seedId, body.startDate, {
      weatherProvider: createScenarioWeather(body.scenario as WeatherScenarioId, body.startDate),
      harvestDayOffset: body.harvestDayOffset,
    });
  } catch (error) {
    if (error instanceof RangeError) throw new HttpError(400, "INVALID_INPUT", "Tanggal tanam atau hari panen berada di luar rentang yang valid.");
    throw error;
  }
}
function tankMix(body: Record<string, unknown>) {
  const keys = ["productId", "area", "capacity", "dose", "water"] as const;
  exactKeys(body, keys);
  if (!keys.every((key) => typeof body[key] === "string" && body[key].length <= 512)) {
    throw new HttpError(400, "INVALID_INPUT", "Lengkapi semua isian dengan teks angka yang valid.");
  }
  const form = Object.fromEntries(keys.map((key) => [key, body[key]])) as unknown as TankMixForm;
  const evaluation = evaluateTankMix(form);
  if (!evaluation.result) throw new HttpError(400, "VALIDATION_ERROR", "Periksa kembali isian perhitungan.", evaluation.errors);
  return evaluation.result;
}

/** Independent HTTP application: no Next.js or browser dependencies. */
export interface ApiOptions {
  databasePath?: string;
  now?: () => number;
  fetchCuaca?: FetchCuaca;
  secureCookies?: boolean;
  allowedOrigins?: readonly string[];
}
export function createApiServer(options: ApiOptions = {}) {
  const database = new DatabaseJuragan(options.databasePath);
  const now = options.now ?? Date.now;
  const otp = new LayananOtp(database, now);
  const cuaca = buatLayananCuaca(options.fetchCuaca, now);
  const origins = options.allowedOrigins ?? ["http://localhost:3000", "http://127.0.0.1:3000"];
  const server = createServer({ requestTimeout: 10_000, headersTimeout: 5_000, maxHeaderSize: 16_384 }, async (req, res) => {
    try {
      const path = (req.url ?? "/").split("?")[0];
      const weatherMatch = path?.match(/^\/api\/lahan\/([a-f0-9-]{36})\/cuaca$/);
      const methods: Record<string, readonly string[]> = {
        "/api/health": ["GET"], "/api/catalog": ["GET"], "/api/timeline": ["POST"], "/api/tank-mix": ["POST"],
        "/api/auth/session": ["GET"], "/api/auth/request-otp": ["POST"], "/api/auth/verify-otp": ["POST"], "/api/auth/logout": ["POST"],
        "/api/lahan": ["GET", "POST"], "/api/lahan/contoh": ["POST"],
      };
      const allowed = weatherMatch ? ["GET"] : methods[path ?? ""];
      if (!allowed) throw new HttpError(404, "NOT_FOUND", "Alamat layanan tidak ditemukan.");
      if (!allowed.includes(req.method ?? "")) {
        res.setHeader("Allow", allowed.join(", "));
        throw new HttpError(405, "METHOD_NOT_ALLOWED", "Metode permintaan tidak didukung.");
      }
      if (path === "/api/health") { send(res, 200, { status: "ok", service: "agri-backend" }); return; }
      if (req.method === "POST" && ((req.headers.origin && !origins.includes(req.headers.origin)) || req.headers["sec-fetch-site"] === "cross-site")) {
        throw new HttpError(403, "ASAL_PERMINTAAN", "Permintaan tidak berasal dari aplikasi ini.");
      }
      if (path === "/api/auth/session") { send(res, 200, { pengguna: otp.pengguna(req), mode: "simulasi" }); return; }
      if (path?.startsWith("/api/lahan")) {
        const pengguna = otp.wajibMasuk(req);
        if (weatherMatch) {
          const lahan = database.lahanMilik(pengguna.id, weatherMatch[1]!);
          send(res, 200, await cuaca(lahan.latitude, lahan.longitude));
        } else if (req.method === "GET") send(res, 200, { lahan: database.daftarLahan(pengguna.id) });
        else {
          const data = await readJson(req);
          if (path === "/api/lahan/contoh") {
            exactKeys(data, []);
            send(res, 200, { lahan: database.tambahContoh(pengguna.id, now()) });
          } else send(res, 201, database.tambahLahan(pengguna.id, validasiLahan(data), now()));
        }
        return;
      }
      if (path === "/api/catalog") {
        const catalog: CatalogResponse = { seeds: SEED_VARIETIES, products: PRODUCT_CATALOG, scenarios: WEATHER_SCENARIOS };
        send(res, 200, catalog);
        return;
      }
      const body = await readJson(req);
      if (path === "/api/auth/request-otp") {
        exactKeys(body, ["nomorHp", "kanal"]);
        send(res, 200, await otp.minta(body.nomorHp, body.kanal, req.socket.remoteAddress ?? "unknown"));
        return;
      }
      if (path === "/api/auth/verify-otp") {
        exactKeys(body, ["id", "kode"]);
        const hasil = otp.verifikasi(body.id, body.kode);
        otp.keluar(req);
        res.setHeader("Set-Cookie", cookieSesi(hasil.token, options.secureCookies ?? false));
        send(res, 200, { pengguna: hasil.pengguna, mode: "simulasi" });
        return;
      }
      if (path === "/api/auth/logout") {
        exactKeys(body, []);
        otp.keluar(req);
        res.setHeader("Set-Cookie", cookieSesi("", options.secureCookies ?? false, true));
        send(res, 200, { selesai: true });
        return;
      }
      send(res, 200, path === "/api/timeline" ? timeline(body) : tankMix(body));
    } catch (error) {
      const known = error instanceof HttpError;
      if (!known) console.error("API request failed:", error);
      if (known && error.status === 413) res.setHeader("Connection", "close");
      const response: ApiErrorResponse = {
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "Layanan sedang bermasalah. Silakan coba lagi.",
          ...(known && error.fields ? { fields: error.fields } : {}),
        },
      };
      if (!res.destroyed) send(res, known ? error.status : 500, response);
    }
  });
  server.once("close", () => database.tutup());
  return server;
}
