import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(webRoot, "node_modules", "pagedjs", "dist", "paged.polyfill.min.js");
const destDir = path.join(webRoot, "public");
const dest = path.join(destDir, "paged.polyfill.min.js");

if (!fs.existsSync(src)) {
  console.error(`pagedjs polyfill not found at ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
