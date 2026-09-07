import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON_BUILD === "1";

/** Next on Windows sometimes emits server chunks under `chunks/` while webpack-runtime requires `./id.js`. */
function copyServerChunksToRuntimeDir() {
  return {
    apply(compiler: {
      hooks: {
        afterEmit: {
          tap: (name: string, fn: (compilation: { outputOptions: { path?: string } }) => void) => void;
        };
      };
    }) {
      compiler.hooks.afterEmit.tap("CopyServerChunksToRuntimeDir", (compilation) => {
        const out = compilation.outputOptions.path;
        if (!out) return;
        const chunksDir = path.join(out, "chunks");
        if (!fs.existsSync(chunksDir)) return;
        for (const file of fs.readdirSync(chunksDir)) {
          if (!file.endsWith(".js")) continue;
          fs.copyFileSync(path.join(chunksDir, file), path.join(out, file));
        }
      });
    }
  };
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: isElectron ? "." : undefined,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(copyServerChunksToRuntimeDir());
    }
    return config;
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: [
    "@mdword/shared",
    "@mdword/document-model",
    "@mdword/myst-parser",
    "@mdword/markdown-serializer",
    "@mdword/layout-engine",
    "@mdword/editor",
    "@mdword/source-editor",
    "@mdword/renderer",
    "@mdword/workspace",
    "@mdword/indexer",
    "@mdword/plugin-sdk",
    "@mdword/ui"
  ]
};

export default nextConfig;
