import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const resources = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../resources");
const svg = path.join(resources, "icon.svg");
const pngPath = path.join(resources, "icon.png");
const icoPath = path.join(resources, "icon.ico");

if (!fs.existsSync(svg)) {
  console.error("Missing", svg);
  process.exit(1);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const size of sizes) {
  pngs.push(await sharp(svg).resize(size, size).png().toBuffer());
}

await sharp(svg).resize(512, 512).png().toFile(pngPath);
fs.writeFileSync(icoPath, packIco(pngs));
console.log("wrote", pngPath, "and", icoPath);

function packIco(buffers) {
  const count = buffers.length;
  const headerSize = 6 + 16 * count;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = headerSize;
  const parts = [header];
  buffers.forEach((png, i) => {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const entry = 6 + i * 16;
    header.writeUInt8(width >= 256 ? 0 : width, entry);
    header.writeUInt8(height >= 256 ? 0 : height, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    parts.push(png);
    offset += png.length;
  });
  return Buffer.concat(parts);
}
