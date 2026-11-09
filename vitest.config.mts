import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/out/**"],
    environment: "node",
    testTimeout: 15000
  },
  resolve: {
    alias: {
      "@mdword/shared": path.resolve(root, "packages/shared/src/index.ts"),
      "@mdword/document-model": path.resolve(root, "packages/document-model/src/index.ts"),
      "@mdword/myst-parser": path.resolve(root, "packages/myst-parser/src/index.ts"),
      "@mdword/markdown-serializer": path.resolve(root, "packages/markdown-serializer/src/index.ts"),
      "@mdword/layout-engine": path.resolve(root, "packages/layout-engine/src/index.ts"),
      "@mdword/plugin-sdk": path.resolve(root, "packages/plugin-sdk/src/index.ts"),
      "@mdword/workspace": path.resolve(root, "packages/workspace/src/index.ts"),
      "@mdword/agent/runtime": path.resolve(root, "packages/agent/src/runtime.ts"),
      "@mdword/agent": path.resolve(root, "packages/agent/src/index.ts"),
      "@mdword/indexer": path.resolve(root, "packages/indexer/src/index.ts"),
      "@mdword/renderer": path.resolve(root, "packages/renderer/src/index.ts")
    }
  }
});
