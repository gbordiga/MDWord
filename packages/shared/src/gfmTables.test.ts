import { describe, expect, it } from "vitest";
import {
  normalizeGfmTables,
  padTableColumns,
  promotePipeParagraphs,
  recoverGfmTableSource,
  unescapeGfmTablePipes
} from "./gfmTables";

describe("normalizeGfmTables", () => {
  it("pads a 3-column delimiter to match a 4-image header", () => {
    const out = normalizeGfmTables(
      `![poster][img-x]| ![][img-x] | ![][img-x] | ![][img-x] |
| ------------------------------------- | ------------------------------------- | ------------------------------------- |
|                                       |                                       |                                       |
`
    );
    const lines = out.split("\n");
    expect(lines[1]).toMatch(/\|.*\|.*\|.*\|.*\|/);
    expect(lines[1]?.split("|").filter((cell) => /---/.test(cell)).length).toBe(4);
    expect(lines[2]?.split("|").length).toBeGreaterThanOrEqual(6);
  });

  it("pads a short header when the delimiter has more columns", () => {
    const out = normalizeGfmTables(`| a | b |\n| --- | --- | --- |\n| 1 | 2 |\n`);
    expect(out.split("\n")[0]?.split("|").filter(Boolean).length).toBe(3);
  });

  it("leaves a balanced table alone", () => {
    const src = `| a | b |\n| --- | --- |\n| 1 | 2 |\n`;
    expect(normalizeGfmTables(src)).toBe(src);
  });

  it("does not rewrite pipes inside a fence", () => {
    const src = "```\n| a | b |\n| --- |\n```\n";
    expect(normalizeGfmTables(src)).toBe(src);
  });
});

describe("promotePipeParagraphs", () => {
  it("turns a pipe paragraph with images into a table", () => {
    const next = promotePipeParagraphs({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "image", url: "./a.png", alt: "poster" },
            { type: "text", value: "| " },
            { type: "image", url: "./a.png", alt: "" },
            {
              type: "text",
              value:
                " |\n| ------------------------------------- | ------------------------------------- |\n|                                       |                                       |"
            }
          ]
        }
      ]
    });
    expect(next.children?.[0]?.type).toBe("table");
    expect(next.children?.[0]?.children?.[0]?.children?.length).toBe(2);
  });

  it("joins adjacent pipe paragraphs into one table", () => {
    const next = promotePipeParagraphs({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "| a | b |" }] },
        { type: "paragraph", children: [{ type: "text", value: "| --- | --- |" }] },
        { type: "paragraph", children: [{ type: "text", value: "| 1 | 2 |" }] }
      ]
    });
    expect(next.children?.[0]?.type).toBe("table");
    expect(next.children?.[0]?.children?.length).toBe(2);
  });
});

describe("padTableColumns", () => {
  it("pads a short body row", () => {
    const next = padTableColumns({
      type: "table",
      children: [
        {
          type: "tableRow",
          children: [{ type: "tableCell" }, { type: "tableCell" }, { type: "tableCell" }]
        },
        { type: "tableRow", children: [{ type: "tableCell" }] }
      ]
    });
    expect(next.children?.[1]?.children?.length).toBe(3);
  });
});

describe("unescapeGfmTablePipes", () => {
  it("unescapes leading table pipes after myst-to-md", () => {
    const out = unescapeGfmTablePipes(
      `![poster][img-x]| ![][img-x] |
\\| ------------------------------------- | ------------------------------------- |
\\|                                       |                                       |
`
    );
    expect(out).not.toContain("\\|");
    expect(out).toContain("| ------------------------------------- | ------------------------------------- |");
  });
});

describe("recoverGfmTableSource", () => {
  it("unescapes a previously restored table and aligns columns", () => {
    const out = recoverGfmTableSource(
      `![poster][img-x]| ![][img-x] | ![][img-x] | ![][img-x] |
\\| ------------------------------------- | ------------------------------------- | ------------------------------------- |
\\|                                       |                                       |                                       |
`
    );
    expect(out).not.toContain("\\|");
    expect(out.split("\n")[1]?.split("|").filter((cell) => /---/.test(cell)).length).toBe(4);
  });
});
