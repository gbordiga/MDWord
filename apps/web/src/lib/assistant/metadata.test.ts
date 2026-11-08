import { describe, expect, it } from "vitest";
import { metadataDiagnostics } from "./env";

const messages = (fm: Record<string, unknown>) => metadataDiagnostics(fm).map((d) => d.message);

describe("metadata diagnostics", () => {
  it("accepts valid metadata and layout", () => {
    expect(
      messages({
        title: "Report",
        language: "it",
        tags: ["a", "b"],
        authors: ["Ada"],
        mdoc: { version: 1, page: { size: "A4", orientation: "landscape" }, margins: { top: "20mm" }, toc: { enabled: true, depth: 3 } }
      })
    ).toEqual([]);
    expect(messages({})).toEqual([]);
  });

  it("rejects lengths without a unit, unknown keys and bad enums in mdoc", () => {
    expect(messages({ mdoc: { margins: { top: 20 } } }).join(" ")).toContain("mdoc.margins.top");
    expect(messages({ mdoc: { page: { orientation: "sideways" } } }).join(" ")).toContain("mdoc.page.orientation");
    expect(messages({ mdoc: { toc: { depth: 9 } } }).join(" ")).toContain("mdoc.toc.depth");
    expect(messages({ mdoc: "wide" })[0]).toContain("mapping");
  });

  it("rejects wrongly typed standard keys", () => {
    expect(messages({ tags: "draft" })).toEqual(["tags must be a list."]);
    expect(messages({ title: 5 })).toEqual(["title must be text."]);
    expect(messages({ authors: 3 })).toEqual(["authors must be a name or a list."]);
  });
});
