import { describe, expect, it } from "vitest";
import { buildNumberingIndex, formatReferenceDisplay } from "./mystNumbering";
import type { GenericNode } from "./constants";

describe("mystNumbering", () => {
  it("numbers figures tables and equations", () => {
    const ast: GenericNode = {
      type: "root",
      children: [
        { type: "container", kind: "figure", label: "fig-a", children: [{ type: "image", url: "a.png", alt: "A" }] },
        {
          type: "table",
          data: { mdwordTable: { label: "tbl-b", caption: "Data" } },
          children: [
            {
              type: "tableRow",
              children: [{ type: "tableCell", children: [{ type: "text", value: "x" }] }]
            }
          ]
        },
        { type: "math", value: "E=mc^2", label: "eq-c" }
      ]
    };
    const index = buildNumberingIndex(ast);
    expect(formatReferenceDisplay(index.byLabel.get("fig-a"))).toBe("Figure 1");
    expect(formatReferenceDisplay(index.byLabel.get("tbl-b"))).toBe("Table 1");
    expect(formatReferenceDisplay(index.byLabel.get("eq-c"), "eq")).toBe("(1)");
  });
});
