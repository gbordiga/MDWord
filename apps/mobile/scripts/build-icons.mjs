import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = path.join(root, "assets", "icon.svg");
const outDir = path.join(root, "assets", "icon");
const png1024 = path.join(outDir, "icon-1024.png");

if (!fs.existsSync(svg)) {
  console.error("Missing", svg);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
await sharp(svg).resize(1024, 1024).png().toFile(png1024);

const androidRes = path.join(root, "android", "app", "src", "main", "res");
const iosApp = path.join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");

const androidDensities = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 }
];

if (fs.existsSync(androidRes)) {
  for (const { folder, size } of androidDensities) {
    const dir = path.join(androidRes, folder);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(png1024).resize(size, size).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(png1024).resize(size, size).png().toFile(path.join(dir, "ic_launcher_round.png"));
    await sharp(png1024).resize(size, size).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  }
}

if (fs.existsSync(iosApp)) {
  await sharp(png1024).resize(1024, 1024).png().toFile(path.join(iosApp, "AppIcon-512@2x.png"));
}

console.log("Wrote store icons from", svg);
