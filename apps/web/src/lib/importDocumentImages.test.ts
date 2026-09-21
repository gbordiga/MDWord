import { describe, expect, it } from "vitest";
import { resolveAndEmbedImages } from "./importImagePlan";

const PNG = "data:image/png;base64,AAAA";

describe("resolveAndEmbedImages", () => {
  it("embeds readable paths, skips missing ones, and leaves http alone", async () => {
    const files = new Map([["/notes/foto.png", PNG]]);
    const result = await resolveAndEmbedImages(["./foto.png", "./gone.png", "https://example.com/a.png"], {
      documentPath: "/notes/readme.md",
      workspaceRoot: "/notes",
      readEmbedded: async (path) => {
        const hit = files.get(path);
        if (!hit) throw new Error("missing");
        return hit;
      }
    });

    expect(result.imported).toEqual([{ src: "./foto.png", path: "/notes/foto.png" }]);
    expect(result.skipped.map((item) => item.src)).toEqual(["./gone.png", "https://example.com/a.png"]);
    expect(result.replacements.get("./foto.png")).toBe(PNG);
  });
});
