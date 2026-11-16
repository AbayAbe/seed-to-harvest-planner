import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// One command starts two independent services; stop both when either exits.
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
if (!["dev", "start"].includes(mode)) throw new Error("Gunakan dev atau start.");
const backendArgs = mode === "dev"
  ? ["--env-file-if-exists=.env", "--import", "tsx", "--watch", "src/server.ts"]
  : ["--env-file-if-exists=.env", "dist/server.js"];
const services = [
  { name: "backend", args: backendArgs },
  { name: "frontend", args: [require.resolve("next/dist/bin/next"), mode, "--port", "3000"] },
];
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else child.kill("SIGTERM");
  }
  process.exitCode = code;
}
for (const service of services) {
  const child = spawn(process.execPath, service.args, {
    cwd: resolve(root, service.name), stdio: "inherit", windowsHide: true,
  });
  children.push(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`Layanan ${service.name} berhenti. Kedua layanan dihentikan.`);
      stop(code ?? 1);
    }
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
