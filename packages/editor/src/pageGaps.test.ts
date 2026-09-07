import { describe, expect, it } from "vitest";
import { astToTiptap } from "./astToTiptap";
import { collectPageGapPositions, snapPageGapPos } from "./pageGaps";
import { tiptapDocFromJson } from "./schemaValid";

describe("snapPageGapPos", () => {
  const doc = tiptapDocFromJson(
    astToTiptap({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "Before" }] },
        {
          type: "table",
          children: [
            {
              type: "tableRow",
              children: [
                { type: "tableCell", header: true, children: [{ type: "text", value: "KPI" }] },
                { type: "tableCell", header: true, children: [{ type: "text", value: "Formula" }] }
              ]
            },
            {
              type: "tableRow",
              children: [
                { type: "tableCell", children: [{ type: "text", value: "ROS" }] },
                { type: "tableCell", children: [{ type: "text", value: "EBIT / Ricavi" }] }
              ]
            }
          ]
        },
        { type: "paragraph", children: [{ type: "text", value: "After" }] }
      ]
    })
  );

  it("leaves positions outside tables unchanged", () => {
    expect(snapPageGapPos(doc, 1)).toBe(1);
  });

  it("moves a hit inside a table to after the table", () => {
    let inside = 0;
    doc.descendants((node, pos) => {
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        inside = pos + 1;
        return false;
      }
      return true;
    });
    expect(inside).toBeGreaterThan(0);
    const snapped = snapPageGapPos(doc, inside);
    const $hit = doc.resolve(inside);
    let tableEnd = 0;
    for (let depth = $hit.depth; depth > 0; depth--) {
      if ($hit.node(depth).type.name === "table") {
        tableEnd = $hit.after(depth);
        break;
      }
    }
    expect(snapped).toBe(tableEnd);
    expect(doc.resolve(snapped).parent.type.name).not.toBe("tableCell");
    expect(doc.resolve(snapped).parent.type.name).not.toBe("table");
  });
});

describe("collectPageGapPositions", () => {
  it("breaks before a block that would enter the next page margin", () => {
    const gaps = collectPageGapPositions(
      [
        { pos: 1, height: 700 },
        { pos: 20, height: 200 },
        { pos: 40, height: 100 }
      ],
      80,
      800
    );
    expect(gaps).toEqual([20]);
  });

  it("does not break a block that already starts a page", () => {
    expect(collectPageGapPositions([{ pos: 1, height: 1200 }], 0, 800)).toEqual([]);
  });

  it("places a second break after a tall first page", () => {
    const gaps = collectPageGapPositions(
      [
        { pos: 1, height: 750 },
        { pos: 10, height: 100 },
        { pos: 20, height: 780 }
      ],
      0,
      800
    );
    expect(gaps).toEqual([10, 20]);
  });
});
