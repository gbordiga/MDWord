import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";
import { getTableMeta, serializeTableMarkdown } from "@mdword/shared";
import { astToTiptap, tiptapToAst } from "./index";

describe("MyST visual convert", () => {
  it("unwraps list-table into editable TipTap table with metadata", () => {
    const parsed = parseMarkdown(`:::{list-table} Cap
:widths: 1 2

* - a
  - b
:::`);
    const doc = astToTiptap(parsed.ast);
    const table = doc.content?.find((n) => n.type === "table");
    expect(table).toBeTruthy();
    expect(table?.attrs?.caption).toBe("Cap");
    expect(table?.attrs?.sourceKind).toBe("list-table");
    expect(table?.content?.[0]?.content?.[0]?.type).toBe("tableHeader");
  });

  it("round-trips inline cite and math through TipTap", () => {
    const parsed = parseMarkdown("See {cite}`smith2020`. $x$");
    const doc = astToTiptap(parsed.ast);
    const para = doc.content?.[0];
    const types = (para?.content ?? []).map((n) => n.type);
    expect(types).toContain("citeChip");
    expect(types).toContain("inlineMath");
    const back = tiptapToAst(doc);
    const inlineTypes = back.children?.[0]?.children?.map((n) => n.type) ?? [];
    expect(inlineTypes).toContain("inlineMath");
    expect(inlineTypes.some((t) => t === "mystRole" || t === "cite")).toBe(true);
  });

  it("maps math block nodes", () => {
    const parsed = parseMarkdown("$$\nx\n$$");
    const doc = astToTiptap(parsed.ast);
    expect(doc.content?.some((n) => n.type === "mathBlock")).toBe(true);
  });

  it("maps a math fence to a mathBlock node and back to $$", () => {
    const parsed = parseMarkdown("```math\nE=mc^2\n```\n");
    const doc = astToTiptap(parsed.ast);
    const block = doc.content?.find((node) => node.type === "mathBlock" || node.type === "codeBlock");
    expect(block?.type).toBe("mathBlock");
    expect(block?.attrs?.latex).toContain("E=mc^2");
    const md = serializeMarkdown({ ast: tiptapToAst(doc) });
    expect(md).toContain("E=mc^2");
  });

  it("serializes table caption and resized column widths to MyST source", () => {
    const parsed = parseMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    const doc = astToTiptap(parsed.ast);
    const table = doc.content?.find((node) => node.type === "table");
    expect(table).toBeTruthy();
    doc.content = [
      {
        ...table!,
        attrs: {
          ...table!.attrs,
          caption: "Quarterly KPI",
          sourceKind: "table"
        },
        content: table!.content?.map((row, rowIndex) =>
          rowIndex === 0
            ? {
                ...row,
                content: row.content?.map((cell, colIndex) => ({
                  ...cell,
                  attrs: { ...cell.attrs, colwidth: [colIndex === 0 ? 180 : 320] }
                }))
              }
            : row
        )
      }
    ];
    const ast = tiptapToAst(doc);
    const tableNode = ast.children?.find((node) => node.type === "table");
    const meta = getTableMeta(tableNode!);
    expect(meta.caption).toBe("Quarterly KPI");
    expect(meta.widths).toEqual([180, 320]);
    const md = serializeTableMarkdown(tableNode!, meta);
    expect(md).toContain("Quarterly KPI");
    expect(md).toContain(":widths: 180 320");
  });
});
