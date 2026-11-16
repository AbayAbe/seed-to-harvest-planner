import { fileURLToPath } from "node:url";

const backendUrl = (process.env.BACKEND_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const pages = process.env.NEXT_PUBLIC_DEMO_STATIC === "true";
if (!pages && !/^https?:\/\//.test(backendUrl)) throw new Error("BACKEND_URL harus berupa URL HTTP/HTTPS.");

/** Mode Pages mengekspor demo lokal; mode server meneruskan API ke backend. */
export default {
  devIndicators: false,
  ...(pages ? { output: "export", trailingSlash: true, basePath: process.env.PAGES_BASE_PATH ?? "", images: { unoptimized: true } } : {}),
  distDir: pages ? "out" : process.env.AGRI_E2E === "true" ? ".next-e2e" : ".next",
  turbopack: { root: fileURLToPath(new URL("../", import.meta.url)) },
  webpack(config) {
    // Modul TypeScript bersama memakai ekstensi .js agar tetap bisa dijalankan Node.
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
  ...(!pages ? { async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  } } : {}),
};
