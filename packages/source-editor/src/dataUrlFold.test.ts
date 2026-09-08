import { describe, expect, it } from "vitest";
import { findDataUrlRanges } from "./dataUrlFold";

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
});
