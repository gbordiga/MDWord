import { describe, expect, it } from "vitest";
import { isMathBlockLanguage } from "./mathBlock";

describe("isMathBlockLanguage", () => {
  it("recognizes math fence languages", () => {
    expect(isMathBlockLanguage("math")).toBe(true);
    expect(isMathBlockLanguage("latex")).toBe(true);
    expect(isMathBlockLanguage("equation")).toBe(true);
    expect(isMathBlockLanguage("mermaid")).toBe(false);
  });
});
