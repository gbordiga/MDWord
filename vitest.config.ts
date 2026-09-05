import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/out/**"],
    environment: "node",
    testTimeout: 15000
  },
  resolve: {
    alias: {
      "@mdword/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@mdword/document-model": path.resolve(
        __dirname,
        "packages/document-model/src/index.ts"
      ),
      "@mdword/myst-parser": path.resolve(
        __dirname,
        "packages/myst-parser/src/index.ts"
      ),
      "@mdword/markdown-serializer": path.resolve(
        __dirname,
        "packages/markdown-serializer/src/index.ts"
      ),
      "@mdword/layout-engine": path.resolve(
        __dirname,
        "packages/layout-engine/src/index.ts"
      ),
      "@mdword/plugin-sdk": path.resolve(
        __dirname,
        "packages/plugin-sdk/src/index.ts"
      ),
      "@mdword/workspace": path.resolve(
        __dirname,
        "packages/workspace/src/index.ts"
      ),
      "@mdword/indexer": path.resolve(__dirname, "packages/indexer/src/index.ts"),
      "@mdword/renderer": path.resolve(__dirname, "packages/renderer/src/index.ts")
    }
  }
});
