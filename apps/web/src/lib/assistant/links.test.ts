import { describe, expect, it } from "vitest";
import { safeHref } from "./links";

describe("safeHref", () => {
  it("allows http, https and mailto only", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:a@b.it")).toBe("mailto:a@b.it");
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "file:///etc/passwd", "mdword://app/x", "/relative", "", undefined]) {
      expect(safeHref(bad)).toBeNull();
    }
  });
});
