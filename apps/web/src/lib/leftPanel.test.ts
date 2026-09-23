import { describe, expect, it } from "vitest";
import { LEFT_PANELS, resolveLeftPanel } from "./leftPanel";

describe("resolveLeftPanel", () => {
  it("keeps known sidebar panels", () => {
    expect(LEFT_PANELS).not.toContain("backlinks");
    expect(LEFT_PANELS).not.toContain("history");
    expect(resolveLeftPanel("files")).toBe("files");
  });

  it("migrates removed sidebar panels", () => {
    expect(resolveLeftPanel("backlinks")).toBe("files");
    expect(resolveLeftPanel("history")).toBe("files");
  });
});
