import { createApiServer } from "./app.js";
import { resolve } from "node:path";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT harus berupa angka 1–65535.");
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_AUTH !== "true") {
  throw new Error("OTP masih simulasi. Pasang penyedia OTP sungguhan sebelum produksi, atau gunakan ALLOW_DEMO_AUTH=true hanya untuk demo terkontrol.");
}
const server = createApiServer({
  databasePath: process.env.DATABASE_PATH === ":memory:" ? ":memory:" : resolve(process.env.DATABASE_PATH ?? "data/juragan.sqlite"),
  secureCookies: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  allowedOrigins: (process.env.FRONTEND_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000").split(",").map((origin) => origin.trim()),
});
server.on("error", (error) => { console.error("Backend gagal dijalankan:", error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Backend siap: http://${host}:${port}/api/health`));
function stop() {
  server.close(() => { process.exitCode = 0; });
  setTimeout(() => server.closeAllConnections(), 5_000).unref();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
