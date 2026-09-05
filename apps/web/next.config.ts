import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: isElectron ? "." : undefined,
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
