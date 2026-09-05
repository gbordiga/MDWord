import { describe, expect, it } from "vitest";
import {
  backlinksTo,
  brokenLinks,
  indexMarkdown,
  resolveWikiTarget,
  searchIndex
} from "./index";

describe("indexer", () => {
  it("indexes titles, headings, tags, wikilinks", () => {
    const doc = indexMarkdown(
      "a.md",
      "---\ntitle: Alpha\ntags:\n  - x\n---\n\n# Heading\n\nSee [[Beta]].\n",
      1
    );
    expect(doc.title).toBe("Alpha");
    expect(doc.headings[0]?.slug).toBe("heading");
    expect(doc.wikilinks[0]?.target).toBe("Beta");
    expect(doc.tags).toContain("x");
  });

  it("resolves backlinks and broken links", () => {
    const a = indexMarkdown("a.md", "# A\n\n[[b]]\n", 1);
    const b = indexMarkdown("b.md", "# B\n", 1);
    const index = { documents: [a, b] };
    expect(resolveWikiTarget(index, "a.md", "b")).toBe("b.md");
    expect(backlinksTo(index, "b.md").map((d) => d.path)).toEqual(["a.md"]);
    const c = indexMarkdown("c.md", "[[missing]]\n", 1);
    expect(brokenLinks({ documents: [a, b, c] }).map((x) => x.target)).toContain(
      "missing"
    );
  });

  it("searches title and body", () => {
    const docs = {
      documents: [
        indexMarkdown("a.md", "# Pump\nhello world", 1),
        indexMarkdown("b.md", "# Other\nnothing", 1)
      ]
    };
    expect(searchIndex(docs, "pump").map((d) => d.path)).toEqual(["a.md"]);
    expect(searchIndex(docs, "world").map((d) => d.path)).toEqual(["a.md"]);
  });
});
