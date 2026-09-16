import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("block source spans", () => {
  it("covers each top-level block inside the original body", () => {
    const source = `---
title: X
---

# One

Hello world.

## Two
`;
    const parsed = parseMarkdown(source);
    expect(parsed.blockSpans.length).toBe(parsed.ast.children?.length);
    expect(parsed.head + parsed.body).toBe(source);
    const heading = parsed.body.slice(parsed.blockSpans[0]!.start, parsed.blockSpans[0]!.end);
    expect(heading).toContain("# One");
    expect(heading).not.toContain("Hello world");
    const para = parsed.body.slice(parsed.blockSpans[1]!.start, parsed.blockSpans[1]!.end);
    expect(para).toContain("Hello world");
  });
});
