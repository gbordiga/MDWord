import { describe, expect, it } from "vitest";
import { unclosedDirectives } from "./directives";

const names = (s: string) => unclosedDirectives(s).map((d) => d.line);

describe("unclosedDirectives", () => {
  it("accepts closed directives, including an empty page break and nesting", () => {
    expect(names("a\n\n:::{page-break}\n:::\n\nb\n")).toEqual([]);
    expect(names("::::{note}\n:::{page-break}\n:::\ntext\n::::\n")).toEqual([]);
    expect(names(":::{figure} a.png\n:width: 50%\n\nCaption\n:::\n")).toEqual([]);
  });

  it("reports a page break without its closing fence, with its line", () => {
    const found = unclosedDirectives("a\n\n:::{page-break}\n\nb\n");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "error", line: 3 });
    expect(found[0]!.message).toContain("{page-break}");
  });

  it("reports each unclosed directive and ignores code fences", () => {
    expect(names(":::{note}\n:::{page-break}\n")).toEqual([1, 2]);
    expect(names("```\n:::{page-break}\n```\n")).toEqual([]);
    expect(names("~~~md\n:::{note}\n~~~\ntext\n")).toEqual([]);
  });
});
