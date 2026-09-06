import { describe, expect, it } from "vitest";
import { matchMarginPreset, mmString, MARGIN_PRESETS } from "./margins";

describe("margin presets", () => {
  it("matches Normal and reports custom when a side differs", () => {
    expect(matchMarginPreset(MARGIN_PRESETS[0]!.margins)).toBe("normal");
    expect(matchMarginPreset({ top: "12.7mm", right: "12.7mm", bottom: "12.7mm", left: "12.7mm" })).toBe(
      "narrow"
    );
    expect(
      matchMarginPreset({ top: "20mm", right: "20mm", bottom: "20mm", left: "40mm" })
    ).toBe("custom");
  });

  it("formats millimetres without trailing noise", () => {
    expect(mmString(20)).toBe("20mm");
    expect(mmString(12.7)).toBe("12.7mm");
  });
});
