import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, "../src");
const dist = path.resolve(root, "../dist");

await build({
  entryPoints: [path.join(src, "main/index.ts")],
  outfile: path.join(dist, "main/index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"]
});

await build({
  entryPoints: [path.join(src, "preload/index.ts")],
  outfile: path.join(dist, "preload/index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"]
});

console.log("desktop main/preload built");
