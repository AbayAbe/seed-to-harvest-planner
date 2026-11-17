import { createClinicApp } from "./router.js";

// Optional standalone service: no dependency on the legacy OTP/SQLite application.
const port = Number(process.env.PORT ?? 4001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT tidak valid.");
const origins = (process.env.FRONTEND_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000").split(",").map(s => s.trim()).filter(Boolean);
const app = createClinicApp(origins);
const server = app.listen(port, process.env.HOST ?? "127.0.0.1", () => console.log(`Klinik Tanaman siap pada port ${port}`));
server.requestTimeout = 60_000;
server.headersTimeout = 10_000;
server.on("error", () => { console.error("Klinik gagal dijalankan. Periksa host dan port."); process.exitCode = 1; });
function stop() { server.close(); setTimeout(() => server.closeAllConnections(), 5000).unref(); }
process.once("SIGINT", stop); process.once("SIGTERM", stop);
