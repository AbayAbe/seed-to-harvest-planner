import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { analysisSchema, ClinicError, createVisionAnalyzer, inputSchema, matchCatalog, type VisionAnalyzer } from "./service.js";

export function createClinicApp(origins: readonly string[], analyze: VisionAnalyzer = createVisionAnalyzer()) {
  const app = express();
  app.disable("x-powered-by");
  // Do not trust arbitrary X-Forwarded-For headers. Configure a known proxy only when deployed.
  app.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) return next(new ClinicError(403, "ORIGIN_DENIED", "Alamat website tidak diizinkan mengakses klinik."));
    if (origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.vary("Origin"); }
    if (req.method === "OPTIONS") { res.set({ "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }); res.status(204).end(); return; }
    next();
  });
  app.use(rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: { code: "RATE_LIMIT", message: "Terlalu banyak permintaan. Coba lagi dalam 15 menit." } } }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 3, fieldSize: 100 },
    fileFilter: (_req, file, cb) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(new ClinicError(415, "IMAGE_FORMAT", "Gunakan foto JPG, PNG, atau WebP."));
      cb(null, true);
    } });
  let active = 0;
  app.post("/api/clinic/identify", (req, res, next) => {
    if (active >= 3) return next(new ClinicError(503, "CLINIC_BUSY", "Klinik sedang penuh. Coba lagi sebentar."));
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    res.once("finish", release); res.once("close", release);
    next();
  }, upload.single("image"), async (req, res) => {
    const input = inputSchema.safeParse(req.body);
    if (!input.success) throw new ClinicError(400, "INPUT_INVALID", "Pilih tanaman dan isi kapasitas tangki 1–100 liter.");
    if (!req.file) throw new ClinicError(400, "IMAGE_REQUIRED", "Pilih satu foto tanaman terlebih dahulu.");
    let image: Buffer;
    try {
      const decoder = sharp(req.file.buffer, { limitInputPixels: 24_000_000, failOn: "warning" });
      const metadata = await decoder.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) throw new Error("Format");
      // Decode actual bytes, constrain pixels, orient, remove EXIF/GPS, then send only a resized JPEG.
      image = await decoder.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch { throw new ClinicError(415, "IMAGE_INVALID", "Foto rusak, terlalu besar dimensinya, atau formatnya tidak didukung. Gunakan foto diam maksimal 24 megapiksel."); }
    if (res.destroyed) return; // Do not spend API credit if the client left during decoding.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.once("close", cancel);
    try {
      const analysis = analysisSchema.parse(await analyze(image, input.data.crop, controller.signal));
      if (!res.destroyed) res.json(matchCatalog(analysis, input.data.crop, input.data.tankLiters));
    } finally { clearTimeout(timer); res.off("close", cancel); }
  });
  app.all("/api/clinic/identify", (_req, res) => { res.setHeader("Allow", "POST, OPTIONS"); res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Gunakan metode POST." } }); });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    if (error instanceof multer.MulterError) { res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: { code: error.code, message: "Unggah satu foto maksimal 5 MB dengan isian tanaman dan tangki." } }); return; }
    if (error instanceof ClinicError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    res.status(502).json({ error: { code: "CLINIC_FAILED", message: "Analisis belum berhasil. Periksa foto lalu coba lagi." } });
  };
  app.use(errors);
  return app;
}
