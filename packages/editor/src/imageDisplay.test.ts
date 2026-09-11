import { describe, expect, it } from "vitest";
import {
  canonicalImageSrc,
  displayImageSrc,
  objectUrlFromDataUrl,
  rewriteDisplayBlobsInTree,
  srcFingerprint
} from "./imageDisplay";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("image display", () => {
  it("fingerprints long data URLs without using the full payload as a key", () => {
    const src = `data:image/png;base64,${"A".repeat(400)}`;
    const key = srcFingerprint(src);
    expect(key.length).toBeLessThan(160);
    expect(key.startsWith(`${src.length}:`)).toBe(true);
  });

  it("reuses the same object URL for the same data URL", () => {
    const first = displayImageSrc(TINY_PNG);
    const second = displayImageSrc(TINY_PNG);
    expect(first).toBe(second);
    expect(first.startsWith("blob:")).toBe(true);
  });

  it("leaves http and relative paths alone", () => {
    expect(displayImageSrc("./photo.png")).toBe("./photo.png");
    expect(displayImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("builds a blob URL from a data URL", () => {
    expect(objectUrlFromDataUrl(TINY_PNG).startsWith("blob:")).toBe(true);
  });

  it("maps a display blob back to the embedded data URL", () => {
    const blob = displayImageSrc(TINY_PNG);
    expect(canonicalImageSrc(blob)).toBe(TINY_PNG);
    const tree = { type: "image", url: blob, alt: "pic" };
    expect(rewriteDisplayBlobsInTree(tree)).toBe(true);
    expect(tree.url).toBe(TINY_PNG);
  });
});
