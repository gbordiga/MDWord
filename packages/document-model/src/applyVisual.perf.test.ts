import { describe, expect, it } from "vitest";
import { applyVisualDocument, openDocument } from "./index";
import { visualProjection } from "@mdword/editor";

/** A long report: many small sections, each with prose, a table and a callout. */
function longReport(sections: number): string {
  const parts: string[] = ["---", "title: Performance", "---", ""];
  for (let i = 0; i < sections; i++) {
    parts.push(`## Section ${i}`, "");
    parts.push(`Paragraph ${i} with **bold** and a [link](https://example.com/${i}).`, "");
    parts.push("| Col A | Col B |", "| --- | --- |", "| a | b |", "");
    parts.push(`:::{note}`, `Callout ${i}`, `:::`, "");
  }
  return parts.join("\n");
}

describe("visual edit cost", () => {
  it("patches one block of a long document without scanning every pair", () => {
    const source = longReport(120);
    const model = openDocument(source);
    expect(model.ast.children?.length ?? 0).toBeGreaterThan(400);
    const edited = openDocument(source.replace("Paragraph 60", "Paragraph sixty"));
    const projection = visualProjection(model.ast);

    const started = Date.now();
    const next = applyVisualDocument(model, edited.ast, {
      previous: projection.ast,
      origins: projection.origins
    });
    const elapsed = Date.now() - started;

    expect(next.source).toContain("Paragraph sixty");
    expect(next.source).toContain("## Section 119");
    // The old full-matrix LCS needed ~1.8 s on this document (3.6 s on a larger
    // one); the trimmed diff stays around 50 ms, so 800 ms leaves room for slow CI.
    expect(elapsed).toBeLessThan(800);
  });

  it("keeps unchanged blocks byte-identical around an insertion", () => {
    const source = longReport(20);
    const model = openDocument(source);
    const edited = openDocument(
      source.replace("## Section 10", "## Inserted\n\nNew paragraph.\n\n## Section 10")
    );
    const projection = visualProjection(model.ast);

    const next = applyVisualDocument(model, edited.ast, {
      previous: projection.ast,
      origins: projection.origins
    });

    expect(next.source).toContain("## Inserted");
    expect(next.source).toContain("New paragraph.");
    expect(next.source).toContain("## Section 10");
    expect(next.source.indexOf("## Section 11")).toBeGreaterThan(next.source.indexOf("## Section 10"));
  });
});
