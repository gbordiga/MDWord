import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

await new Promise((r) => setTimeout(r, 2500));

const electron = spawn("pnpm", ["exec", "electron", "."], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" }
});

const stop = () => {
  next.kill();
  electron.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
