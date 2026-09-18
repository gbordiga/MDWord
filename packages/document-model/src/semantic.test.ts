import { describe, expect, it } from "vitest";
import { withTableMeta } from "@mdword/shared";
import { semanticAstEqual } from "./semantic";

describe("semanticAstEqual", () => {
  it("detects table metadata changes", () => {
    const table = {
      type: "table",
      children: [{ type: "tableRow", children: [{ type: "tableCell", children: [] }] }]
    };
    const left = { type: "root", children: [withTableMeta(table, { caption: "Before" })] };
    const right = { type: "root", children: [withTableMeta(table, { caption: "After" })] };
    expect(semanticAstEqual(left, right)).toBe(false);
  });
});
