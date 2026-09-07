import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // Next is still starting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const icons = spawnSync(process.execPath, [path.join(root, "scripts/build-icons.mjs")], {
  cwd: root,
  stdio: "inherit"
});
if (icons.status) process.exit(icons.status);

await build({
  entryPoints: [path.join(root, "src/main/index.ts")],
  outfile: path.join(root, "dist/main/index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"]
});
await build({
  entryPoints: [path.join(root, "src/preload/index.ts")],
  outfile: path.join(root, "dist/preload/index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"]
});

const next = spawn("pnpm", ["--filter", "@mdword/web", "dev"], {
  cwd: path.resolve(root, "../.."),
  stdio: "inherit",
  shell: true
});

await waitForHttp("http://127.0.0.1:3000");

const electronEnv = { ...process.env };
delete electronEnv.ELECTRON_RUN_AS_NODE;

const electron = spawn("pnpm", ["exec", "electron", "."], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: electronEnv
});

const stop = () => {
  next.kill();
  electron.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
