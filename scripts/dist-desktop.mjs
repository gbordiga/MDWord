import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "apps/web/out");
const dest = path.join(root, "apps/desktop/resources/web");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env }
  });
  if (result.status) process.exit(result.status);
}

run("pnpm", ["build:web"], { ELECTRON_BUILD: "1" });

if (!fs.existsSync(src)) {
  console.error(`Web export not found at ${src}`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`staged web export → ${dest}`);

run("pnpm", ["--filter", "@mdword/desktop", "dist"]);
