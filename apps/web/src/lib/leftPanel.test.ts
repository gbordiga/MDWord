import { describe, expect, it } from "vitest";
import { LEFT_PANELS, resolveLeftPanel } from "./leftPanel";

describe("resolveLeftPanel", () => {
  it("keeps known sidebar panels", () => {
    expect(LEFT_PANELS).not.toContain("backlinks");
    expect(resolveLeftPanel("history")).toBe("history");
  });

  it("migrates the removed backlinks panel", () => {
    expect(resolveLeftPanel("backlinks")).toBe("files");
  });
});
