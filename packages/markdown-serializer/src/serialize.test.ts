import { describe, expect, it } from "vitest";
import { serializeMarkdown } from "./serialize";
import { parseMarkdown } from "@mdword/myst-parser";

describe("golden serialize", () => {
  it("emits a heading and paragraph", () => {
    const parsed = parseMarkdown("# Title\n\nHello.\n");
    const out = serializeMarkdown({ ast: parsed.ast, yaml: parsed.yaml });
    expect(out).toMatch(/# Title/);
    expect(out).toMatch(/Hello/);
  });

  it("emits wikilinks not the internal scheme", () => {
    const parsed = parseMarkdown("See [[Doc]].\n");
    const out = serializeMarkdown({ ast: parsed.ast, yaml: parsed.yaml });
    expect(out).toContain("[[Doc]]");
    expect(out).not.toContain("mdoc-wiki:");
  });
});
