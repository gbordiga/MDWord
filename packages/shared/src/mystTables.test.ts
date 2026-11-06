import { describe, expect, it } from "vitest";
import {
  getTableMeta,
  serializeTableMarkdown,
  substituteRichTables,
  tableMetaFromDirective,
  tableMetaNeedsDirective,
  tableToGfm,
  withTableMeta
} from "./mystTables";
import type { GenericNode } from "./constants";

const simpleTable: GenericNode = {
  type: "table",
  children: [
    {
      type: "tableRow",
      children: [
        { type: "tableCell", header: true, align: "left", children: [{ type: "text", value: "A" }] },
        { type: "tableCell", header: true, align: "right", children: [{ type: "text", value: "B" }] }
      ]
    },
    {
      type: "tableRow",
      children: [
        { type: "tableCell", align: "left", children: [{ type: "text", value: "1" }] },
        { type: "tableCell", align: "right", children: [{ type: "text", value: "2" }] }
      ]
    }
  ]
};

describe("mystTables", () => {
  it("writes GFM with alignment colons", () => {
    expect(tableToGfm(simpleTable)).toContain("---:");
    expect(tableToGfm(simpleTable)).toMatch(/\| --- \| ---:/);
  });

  it("escapes backslashes before pipes in GFM cells", () => {
    const table: GenericNode = {
      type: "table",
      children: [
        {
          type: "tableRow",
          children: [{ type: "tableCell", children: [{ type: "text", value: "a|b" }] }]
        },
        {
          type: "tableRow",
          children: [{ type: "tableCell", children: [{ type: "text", value: "c\\d|e" }] }]
        }
      ]
    };
    const md = tableToGfm(table);
    expect(md).toContain("| a\\|b |");
    expect(md).toContain("| c\\\\d\\|e |");
  });

  it("keeps an image inside a MyST table cell", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const table: GenericNode = {
      type: "table",
      children: [
        {
          type: "tableRow",
          children: [
            { type: "tableCell", header: true, children: [{ type: "text", value: "A" }] },
            { type: "tableCell", header: true, children: [{ type: "text", value: "B" }] }
          ]
        },
        {
          type: "tableRow",
          children: [
            { type: "tableCell", children: [{ type: "paragraph", children: [{ type: "text", value: "x" }] }] },
            {
              type: "tableCell",
              children: [{ type: "image", url: png, alt: "pic", title: "width=40%" }]
            }
          ]
        }
      ]
    };
    const md = serializeTableMarkdown(table, { caption: "KPI", sourceKind: "table" });
    expect(md).toContain(":::{table} KPI");
    expect(md).toContain(`![pic](${png}){width=40%}`);
    expect(md).toMatch(/\| x \| !\[pic\]/);
  });

  it("writes MyST :align: for table placement", () => {
    const meta = tableMetaFromDirective("table", { align: "center" }, "KPI");
    const md = serializeTableMarkdown(withTableMeta(simpleTable, meta), meta);
    expect(md).toContain(":::{table} KPI");
    expect(md).toContain(":align: center");
  });

  it("promotes to list-table directive when metadata requires it", () => {
    const meta = tableMetaFromDirective("list-table", { widths: "20 50 30", "header-rows": "1" }, "Caption");
    const md = serializeTableMarkdown(withTableMeta(simpleTable, meta), meta);
    expect(md).toContain(":::{list-table} Caption");
    expect(md).toContain(":widths: 20 50 30");
  });

  it("substitutes rich tables with placeholders for myst-to-md", () => {
    const meta = { caption: "KPI", sourceKind: "table" as const };
    const wrapped = withTableMeta(simpleTable, meta);
    expect(tableMetaNeedsDirective(meta, simpleTable)).toBe(true);
    const { ast, snippets } = substituteRichTables({ type: "root", children: [wrapped] });
    expect(ast.children?.[0]?.type).toBe("html");
    expect(snippets[0]).toContain(":::{table} KPI");
  });

  it("reads table meta from data bag", () => {
    const meta = { caption: "x", widths: [1, 2] as number[] };
    expect(getTableMeta(withTableMeta(simpleTable, meta)).caption).toBe("x");
  });
});

describe("GFM cell whitespace", () => {
  function oneCell(value: string): GenericNode {
    return {
      type: "table",
      children: [
        { type: "tableRow", children: [{ type: "tableCell", children: [{ type: "text", value }] }] },
        { type: "tableRow", children: [{ type: "tableCell", children: [{ type: "text", value: "x" }] }] }
      ]
    };
  }

  it("collapses each whitespace run that contains a newline", () => {
    expect(tableToGfm(oneCell("a \n b"))).toContain("| a b |");
    expect(tableToGfm(oneCell("a\n\nb"))).toContain("| a b |");
    expect(tableToGfm(oneCell("a\r\n b"))).toContain("| a b |");
    expect(tableToGfm(oneCell("a  b"))).toContain("| a  b |");
    expect(tableToGfm(oneCell("\nstart"))).toContain("| start |");
  });

  it("keeps a long whitespace run without a newline untouched, quickly", () => {
    const started = Date.now();
    // A run with no newline is the shape that makes `\s*\n\s*` quadratic.
    expect(tableToGfm(oneCell(" ".repeat(100_000) + "x"))).toContain("| x |");
    const mixed = "start" + " \n".repeat(5_000) + "end";
    expect(tableToGfm(oneCell(mixed))).toContain("| start end |");
    expect(Date.now() - started).toBeLessThan(500);
  });
});
