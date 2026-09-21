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
