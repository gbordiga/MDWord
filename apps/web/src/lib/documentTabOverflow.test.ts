import { describe, expect, it } from "vitest";
import { nextTabStripScrollLeft, scrollLeftToRevealTab, tabOverflowFlags } from "./documentTabOverflow";

describe("documentTabOverflow", () => {
  it("hides both carets when everything fits", () => {
    expect(tabOverflowFlags(0, 400, 400)).toEqual({ canScrollLeft: false, canScrollRight: false });
  });

  it("shows the right caret at the start of an overflowing strip", () => {
    expect(tabOverflowFlags(0, 800, 400)).toEqual({ canScrollLeft: false, canScrollRight: true });
  });

  it("shows the left caret after scrolling, and both in the middle", () => {
    expect(tabOverflowFlags(200, 800, 400)).toEqual({ canScrollLeft: true, canScrollRight: true });
    expect(tabOverflowFlags(400, 800, 400)).toEqual({ canScrollLeft: true, canScrollRight: false });
  });

  it("pages the visible window without passing the ends", () => {
    expect(nextTabStripScrollLeft(0, 400, 1000, 1)).toBe(340);
    expect(nextTabStripScrollLeft(340, 400, 1000, 1)).toBe(600);
    expect(nextTabStripScrollLeft(100, 400, 1000, -1)).toBe(0);
  });

  it("keeps a fully visible tab in place and reveals a clipped one", () => {
    expect(scrollLeftToRevealTab(40, 80, 0, 400)).toBeNull();
    expect(scrollLeftToRevealTab(0, 80, 40, 400)).toBe(0);
    expect(scrollLeftToRevealTab(360, 80, 0, 400)).toBe(48);
  });
});
