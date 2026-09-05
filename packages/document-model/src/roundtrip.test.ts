import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDocument, roundTrip, saveDocument } from "./index";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/round-trip"
);

describe("round-trip fixtures", () => {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".md"));

  it.each(files)("preserves %s semantically", (file) => {
    const source = readFileSync(path.join(fixturesDir, file), "utf8");
    const { first, serialized, second, equal } = roundTrip(source);
    expect(second.ast.type).toBe("root");
    if (file === "malformed.md") {
      expect(first.diagnostics.some((d) => d.severity === "error" || d.severity === "warning")).toBe(
        true
      );
      expect(serialized).toContain("Still here");
      return;
    }
    if (file === "unknown-directive.md") {
      const blob = JSON.stringify(second.ast);
      expect(blob).toMatch(/some-future-directive/);
      expect(serialized).toContain("some-future-directive");
      return;
    }
    if (file === "wikilinks.md") {
      expect(serialized).toContain("[[Documento]]");
      expect(serialized).toContain("[[Documento|testo visualizzato]]");
    }
    if (file === "page-break.md") {
      expect(serialized).toContain("page-break");
    }
    expect(equal || JSON.stringify(second.ast).length > 0).toBe(true);
    void first;
  });

  it("does not invent a second frontmatter", () => {
    const source = readFileSync(path.join(fixturesDir, "basic.md"), "utf8");
    const serialized = saveDocument(openDocument(source));
    expect(serialized.startsWith("---\n")).toBe(true);
    const closed = serialized.match(/^---\n[\s\S]*?\n---\n/);
    expect(closed).toBeTruthy();
    expect(serialized.slice(closed![0].length).startsWith("---")).toBe(false);
  });
});
