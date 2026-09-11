import { describe, expect, it } from "vitest";
import { outputMime, scaleToMaxEdge, shouldKeepOriginal, IMAGE_MAX_EDGE } from "./imageEmbed";

describe("image embed policy", () => {
  it("scales only when the long edge exceeds the cap", () => {
    expect(scaleToMaxEdge(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    const down = scaleToMaxEdge(4000, 3000);
    expect(down.width).toBe(IMAGE_MAX_EDGE);
    expect(down.height).toBe(1200);
    expect(down.scale).toBeLessThan(1);
  });

  it("keeps GIFs but re-encodes PNG stills to JPEG", () => {
    expect(shouldKeepOriginal({ width: 4000, height: 3000, bytes: 2_000_000, type: "image/gif" })).toBe(true);
    expect(shouldKeepOriginal({ width: 400, height: 300, bytes: 80_000, type: "image/png" })).toBe(false);
    expect(shouldKeepOriginal({ width: 4000, height: 3000, bytes: 80_000, type: "image/jpeg" })).toBe(false);
    expect(shouldKeepOriginal({ width: 1200, height: 800, bytes: 80_000, type: "image/jpeg" })).toBe(true);
    expect(shouldKeepOriginal({ width: 1200, height: 800, bytes: 2_000_000, type: "image/jpeg" })).toBe(false);
  });

  it("re-encodes stills as JPEG", () => {
    expect(outputMime("image/jpeg", true)).toBe("image/jpeg");
    expect(outputMime("image/webp", true)).toBe("image/jpeg");
    expect(outputMime("image/png", true)).toBe("image/jpeg");
  });
});
