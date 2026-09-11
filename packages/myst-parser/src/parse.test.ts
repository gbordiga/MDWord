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

  it("parses a large embedded image without hanging and keeps the payload", () => {
    const payload = "A".repeat(200_000);
    const src = `data:image/png;base64,${payload}`;
    const started = Date.now();
    const result = parseMarkdown(`![pic](${src})\n`);
    expect(Date.now() - started).toBeLessThan(250);
    const blob = JSON.stringify(result.ast);
    expect(blob).toContain(src);
    expect(blob).not.toContain("MDWORDIMG");
  });

  it("resolves a CommonMark reference image whose definition is a data URL", () => {
    const src = `data:image/jpeg;base64,/9j/${"B".repeat(200)}`;
    const result = parseMarkdown(`# Foto

![pic][img-pump]

| a | ![cell][img-pump] |
| --- | --- |

[img-pump]: ${src}
`);
    const blob = JSON.stringify(result.ast);
    expect(blob).toContain(src);
    expect(blob.match(/"type":"image"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(blob).not.toContain("img-pump");
  });
});
