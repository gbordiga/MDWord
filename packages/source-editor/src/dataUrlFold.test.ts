import { describe, expect, it } from "vitest";
import { findDataUrlRanges, foldEmbeddedDataUrls, stubEmbeddedImages, stubEmbeddedImagesForDisplay, stubToken } from "./dataUrlFold";
import { displayImageStub } from "@mdword/shared";

describe("data URL fold", () => {
  it("hides long base64 payloads", () => {
    const payload = "A".repeat(80);
    const src = `![x](data:image/png;base64,${payload})`;
    const ranges = findDataUrlRanges(src);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.preview).toContain("…");
    expect((ranges[0]?.to ?? 0) - (ranges[0]?.from ?? 0)).toBeGreaterThan(48);
  });

  it("leaves short data URLs visible", () => {
    expect(findDataUrlRanges("![x](data:image/png;base64,AAAA)")).toEqual([]);
  });

  it("scans a large payload without hanging", () => {
    const payload = "B".repeat(200_000);
    const src = `before ![pic](data:image/jpeg;base64,${payload}) after`;
    const started = Date.now();
    const ranges = findDataUrlRanges(src);
    expect(Date.now() - started).toBeLessThan(50);
    expect(ranges).toHaveLength(1);
    expect(foldEmbeddedDataUrls(src).length).toBeLessThan(80);
  });

  it("stubs a definition as a visible placeholder, not a fake data URL", () => {
    const payload = "D".repeat(80);
    const src = `data:image/jpeg;base64,${payload}`;
    const md = `![pic][img-x]\n\n[img-x]: ${src}\n`;
    const stub = stubEmbeddedImagesForDisplay(md);
    expect(stub.display).toContain(displayImageStub(0, src));
    expect(stub.display).not.toContain(payload);
    expect(stub.display).not.toContain("data:image/jpeg;base64,MDWORDIMG");
    expect(stub.restore(stub.display)).toBe(md);
  });

  it("folds a trailing CommonMark data-URL definition", () => {
    const payload = "D".repeat(80);
    const src = `data:image/jpeg;base64,${payload}`;
    const md = `![pic][img-x]\n\n[img-x]: ${src}\n`;
    const folded = foldEmbeddedDataUrls(md);
    expect(folded).toContain("![pic][img-x]");
    expect(folded).toContain("[img-x]:");
    expect(folded).not.toContain(payload);
  });

  it("stubs and restores embedded images", () => {
    const url = `data:image/png;base64,${"C".repeat(80)}`;
    const source = `| a | ![pic](${url}) |\n`;
    const stub = stubEmbeddedImages(source);
    expect(stub.display).toContain(stubToken(0));
    expect(stub.display).not.toContain("C".repeat(80));
    expect(stub.restore(stub.display)).toBe(source);
    expect(stub.restore(stub.display.replace("pic", "foto"))).toContain(url);
  });
});
