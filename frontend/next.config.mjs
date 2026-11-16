import { fileURLToPath } from "node:url";

const backendUrl = (process.env.BACKEND_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
if (!/^https?:\/\//.test(backendUrl)) throw new Error("BACKEND_URL harus berupa URL HTTP/HTTPS.");

/** The Next.js server forwards requests; all domain logic lives in backend/. */
export default {
  devIndicators: false,
  distDir: process.env.AGRI_E2E === "true" ? ".next-e2e" : ".next",
  turbopack: { root: fileURLToPath(new URL("../", import.meta.url)) },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};
