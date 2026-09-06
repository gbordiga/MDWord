import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(root, "../..");
const svg = path.join(root, "assets", "icon.svg");
const outDir = path.join(root, "assets", "icon");
const png1024 = path.join(outDir, "icon-1024.png");

if (!fs.existsSync(svg)) {
  console.error("Missing", svg);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
await sharp(svg).resize(1024, 1024).png().toFile(png1024);

async function splashPng(width, height, dest) {
  const iconSize = Math.round(Math.min(width, height) * 0.28);
  const icon = await sharp(png1024).resize(iconSize, iconSize).png().toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([{ input: icon, gravity: "centre" }])
    .png()
    .toFile(dest);
}

const androidRes = path.join(root, "android", "app", "src", "main", "res");
const iosIcon = path.join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
const iosSplash = path.join(root, "ios", "App", "App", "Assets.xcassets", "Splash.imageset");

const androidDensities = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 }
];

const androidSplashes = [
  { folder: "drawable", width: 480, height: 800 },
  { folder: "drawable-port-mdpi", width: 320, height: 480 },
  { folder: "drawable-port-hdpi", width: 480, height: 800 },
  { folder: "drawable-port-xhdpi", width: 720, height: 1280 },
  { folder: "drawable-port-xxhdpi", width: 960, height: 1600 },
  { folder: "drawable-port-xxxhdpi", width: 1280, height: 1920 },
  { folder: "drawable-land-mdpi", width: 480, height: 320 },
  { folder: "drawable-land-hdpi", width: 800, height: 480 },
  { folder: "drawable-land-xhdpi", width: 1280, height: 720 },
  { folder: "drawable-land-xxhdpi", width: 1600, height: 960 },
  { folder: "drawable-land-xxxhdpi", width: 1920, height: 1280 }
];

if (fs.existsSync(androidRes)) {
  for (const { folder, size } of androidDensities) {
    const dir = path.join(androidRes, folder);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(png1024).resize(size, size).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(png1024).resize(size, size).png().toFile(path.join(dir, "ic_launcher_round.png"));
    await sharp(png1024).resize(size, size).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  }
  for (const { folder, width, height } of androidSplashes) {
    const dir = path.join(androidRes, folder);
    fs.mkdirSync(dir, { recursive: true });
    await splashPng(width, height, path.join(dir, "splash.png"));
  }
}

if (fs.existsSync(iosIcon)) {
  await sharp(png1024).resize(1024, 1024).png().toFile(path.join(iosIcon, "AppIcon-512@2x.png"));
}

if (fs.existsSync(iosSplash)) {
  const square = path.join(outDir, "splash-2732.png");
  await splashPng(2732, 2732, square);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    fs.copyFileSync(square, path.join(iosSplash, name));
  }
}

const webPublic = path.join(repo, "apps/web/public");
fs.mkdirSync(webPublic, { recursive: true });
await sharp(png1024).resize(192, 192).png().toFile(path.join(webPublic, "icon-192.png"));
await sharp(png1024).resize(512, 512).png().toFile(path.join(webPublic, "icon-512.png"));
await sharp(png1024).resize(180, 180).png().toFile(path.join(webPublic, "apple-touch-icon.png"));

const desktopRes = path.join(repo, "apps/desktop/resources");
if (fs.existsSync(desktopRes)) {
  await sharp(png1024).resize(512, 512).png().toFile(path.join(desktopRes, "icon.png"));
}

console.log("Wrote MDWord icons and splash screens");
