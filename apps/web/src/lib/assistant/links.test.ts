import { describe, expect, it } from "vitest";
import { linkifyWikilinks, safeHref, wikiTargetFromHref } from "./links";

describe("safeHref", () => {
  it("allows http, https and mailto only", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:a@b.it")).toBe("mailto:a@b.it");
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "file:///etc/passwd", "mdword://app/x", "/relative", "", undefined]) {
      expect(safeHref(bad)).toBeNull();
    }
  });
});

describe("linkifyWikilinks", () => {
  it("turns wikilinks into in-app links and leaves code alone", () => {
    expect(linkifyWikilinks("See [[Notes]] and [[Page#Intro|the intro]].")).toBe(
      "See [Notes](#wiki:Notes) and [the intro](#wiki:Page)."
    );
    expect(linkifyWikilinks("Keep `[[Literal]]` and\n```\n[[Code]]\n```\n")).toBe(
      "Keep `[[Literal]]` and\n```\n[[Code]]\n```\n"
    );
    expect(wikiTargetFromHref("#wiki:My%20Page")).toBe("My Page");
    expect(wikiTargetFromHref("https://example.com")).toBeNull();
  });
});
