#!/usr/bin/env node
/**
 * Fail a release when the GitHub Release is missing a desktop installer or the
 * auto-update metadata, or when that metadata points at another version.
 *
 * Usage: node scripts/verify-release.mjs <tag> [owner/repo]
 * Requires network access. Set GH_TOKEN to avoid anonymous rate limits.
 */
const tag = process.argv[2];
const repo = process.argv[3] ?? process.env.GITHUB_REPOSITORY ?? "gbordiga/MDWord";

if (!tag) {
  console.error("usage: node scripts/verify-release.mjs <tag> [owner/repo]");
  process.exit(2);
}

const version = tag.replace(/^v/, "");
const requiredFiles = [
  { label: "Windows installer", name: `MDWord-Setup-${version}.exe` },
  { label: "Windows blockmap", name: `MDWord-Setup-${version}.exe.blockmap` },
  { label: "Linux AppImage", name: `MDWord-${version}.AppImage` },
  { label: "Linux deb", name: `MDWord-${version}.deb` },
  { label: "Windows update metadata", name: "latest.yml", expectVersion: true },
  { label: "Linux update metadata", name: "latest-linux.yml", expectVersion: true }
];

const headers = { accept: "application/vnd.github+json", "user-agent": "mdword-release-check" };
if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;

const url = `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
const response = await fetch(url, { headers });
if (!response.ok) {
  console.error(`Could not read release ${tag} in ${repo}: HTTP ${response.status}`);
  process.exit(1);
}
const release = await response.json();
const assets = new Map((release.assets ?? []).map((asset) => [asset.name, asset]));

let failed = false;
for (const { label, name, expectVersion } of requiredFiles) {
  const asset = assets.get(name);
  if (!asset) {
    failed = true;
    console.error(`MISSING ${label}: ${name}`);
    continue;
  }
  if (!expectVersion) {
    console.log(`ok    ${label}: ${name} (${Math.round(asset.size / 1024)} KB)`);
    continue;
  }
  const text = await download(asset.browser_download_url);
  const published = /^version:\s*(\S+)\s*$/m.exec(text ?? "")?.[1];
  if (published !== version) {
    failed = true;
    console.error(`STALE  ${label}: ${name} points at ${published ?? "an unknown version"}, expected ${version}`);
    continue;
  }
  console.log(`ok    ${label}: ${name} -> ${published}`);
}

if (failed) {
  console.error(
    `Release ${tag} is incomplete. Assets: ${[...assets.keys()].join(", ") || "(none)"}`
  );
  process.exit(1);
}
console.log(`Release ${tag} has every desktop artifact and matching update metadata.`);

async function download(downloadUrl) {
  const assetResponse = await fetch(downloadUrl, {
    headers: { "user-agent": "mdword-release-check", ...(process.env.GH_TOKEN ? { authorization: headers.authorization } : {}) },
    redirect: "follow"
  });
  if (!assetResponse.ok) {
    console.error(`Could not download ${downloadUrl}: HTTP ${assetResponse.status}`);
    return null;
  }
  return assetResponse.text();
}
