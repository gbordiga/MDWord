import { describe, expect, it } from "vitest";
import { cssContentValue, pageMarginCss, runningBarsHtml } from "./running";

describe("cssContentValue", () => {
  it("maps page tokens to CSS counters after resolving metadata", () => {
    expect(cssContentValue("{{title}} — {{page}}", { title: "Audit" })).toBe(
      JSON.stringify("Audit — ") + " counter(page)"
    );
    expect(cssContentValue("{{page}} / {{pages}}")).toBe("counter(page) " + JSON.stringify(" / ") + " counter(pages)");
  });
});

describe("pageMarginCss", () => {
  it("emits only boxes that still need page counters when pageTokensOnly", () => {
    const css = pageMarginCss(
      { left: "{{title}}", right: "{{page}} / {{pages}}" },
      { right: "{{date}}" },
      { title: "Audit", date: "2026-01-01" },
      { pageTokensOnly: true }
    );
    expect(css).toMatch(/@top-right/);
    expect(css).toMatch(/counter\(page\)/);
    expect(css).not.toMatch(/@top-left/);
    expect(css).not.toMatch(/@bottom-right/);
  });
});

describe("runningBarsHtml", () => {
  it("resolves metadata and drops page tokens so Chromium cannot paint 0 / 0", () => {
    const bars = runningBarsHtml(
      { left: "{{title}}", right: "{{page}} / {{pages}}" },
      { right: "{{date}}" },
      { title: "Audit", date: "2026-01-01" }
    );
    expect(bars.header).toContain("Audit");
    expect(bars.header).not.toContain("{{page}}");
    expect(bars.header).not.toContain("print-page");
    expect(bars.footer).toContain("2026-01-01");
  });
});
