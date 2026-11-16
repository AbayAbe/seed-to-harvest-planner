import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build", "frontend", "--webpack"], {
  cwd: root, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_DEMO_STATIC: "true" },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
