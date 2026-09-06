import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("page-break directive", () => {
  it("parses :::{page-break} without a myst unknown-directive error", () => {
    const result = parseMarkdown(`# Page break

First page content.

:::{page-break}
:::

Second page content.
`);
    const blob = JSON.stringify(result.ast);
    expect(blob).toContain("page-break");
    expect(result.diagnostics.filter((d) => d.code === "myst")).toEqual([]);
    expect(result.diagnostics.some((d) => /unknown directive/i.test(d.message))).toBe(false);
  });
});
