import { describe, expect, it } from "vitest";
import { astToTiptap } from "./astToTiptap";
import { tiptapToAst } from "./tiptapToAst";
import { collectEmptyTextPaths, tiptapDocFromJson } from "./schemaValid";
import { parseMarkdown } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";

describe("tiptap conversion", () => {
  it("maps headings, emphasis and lists", () => {
    const ast = {
      type: "root",
      children: [
        {
          type: "heading",
          depth: 1,
          children: [{ type: "text", value: "Title" }]
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Hello " },
            { type: "strong", children: [{ type: "text", value: "world" }] }
          ]
        }
      ]
    };
    const json = astToTiptap(ast);
    expect(json.type).toBe("doc");
    expect(json.content?.[0]?.type).toBe("heading");
    const back = tiptapToAst(json);
    expect(back.children?.[0]?.type).toBe("heading");
  });

  it("round-trips ordered lists, links and blockquotes", () => {
    const ast = {
      type: "root",
      children: [
        {
          type: "list",
          ordered: true,
          children: [
            {
              type: "listItem",
              children: [{ type: "paragraph", children: [{ type: "text", value: "Uno" }] }]
            },
            {
              type: "listItem",
              children: [{ type: "paragraph", children: [{ type: "text", value: "Due" }] }]
            }
          ]
        },
        {
          type: "blockquote",
          children: [{ type: "paragraph", children: [{ type: "text", value: "Citazione" }] }]
        },
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "https://example.com",
              children: [{ type: "text", value: "example" }]
            }
          ]
        }
      ]
    };
    const json = astToTiptap(ast);
    expect(json.content?.[0]?.type).toBe("orderedList");
    expect(json.content?.[1]?.type).toBe("blockquote");
    const linkMark = json.content?.[2]?.content?.[0]?.marks?.find((m) => m.type === "link");
    expect(linkMark?.attrs?.href).toBe("https://example.com");
    const back = tiptapToAst(json);
    expect(back.children?.[0]).toMatchObject({ type: "list", ordered: true });
    expect(back.children?.[1]?.type).toBe("blockquote");
    expect(back.children?.[2]?.children?.[0]).toMatchObject({
      type: "link",
      url: "https://example.com"
    });
  });

  it("does not emit empty text nodes for empty table cells", () => {
    const ast = {
      type: "root",
      children: [
        {
          type: "table",
          children: [
            {
              type: "tableRow",
              children: [
                { type: "tableCell", header: true, children: [] },
                {
                  type: "tableCell",
                  header: true,
                  children: [{ type: "text", value: "KPI" }]
                }
              ]
            },
            {
              type: "tableRow",
              children: [
                { type: "tableCell", children: [] },
                {
                  type: "tableCell",
                  children: [{ type: "paragraph", children: [{ type: "text", value: "ROS" }] }]
                }
              ]
            }
          ]
        }
      ]
    };
    const json = astToTiptap(ast);
    expect(collectEmptyTextPaths(json)).toEqual([]);
    const doc = tiptapDocFromJson(json);
    expect(doc.textContent).toContain("KPI");
    expect(doc.textContent).toContain("ROS");
  });

  it("keeps empty paragraphs and list items schema-valid", () => {
    const json = astToTiptap({
      type: "root",
      children: [
        { type: "paragraph", children: [] },
        {
          type: "list",
          children: [{ type: "listItem", children: [] }]
        }
      ]
    });
    expect(collectEmptyTextPaths(json)).toEqual([]);
    expect(tiptapDocFromJson(json).childCount).toBeGreaterThan(0);
  });

  it("round-trips a simple markdown image without extra directives", () => {
    const parsed = parseMarkdown("![Alt text](./images/demo.png)\n");
    const json = astToTiptap(parsed.ast);
    expect(json.content?.[0]?.type).toBe("figure");
    expect(json.content?.[0]?.attrs).toMatchObject({
      src: "./images/demo.png",
      alt: "Alt text",
      width: 100,
      layout: "block-center"
    });
    expect(collectEmptyTextPaths(json)).toEqual([]);
    expect(tiptapDocFromJson(json).childCount).toBe(1);
    const back = tiptapToAst(json);
    const md = serializeMarkdown({ ast: back });
    expect(md).toContain("![Alt text](./images/demo.png)");
    expect(md).not.toContain("```{image}");
  });

  it("keeps figure width, float and caption", () => {
    const parsed = parseMarkdown(`:::{figure} ./images/pump.png
:align: left
:width: 40%
:class: float

Schema della pompa.
:::
`);
    const json = astToTiptap(parsed.ast);
    expect(json.content?.[0]?.type).toBe("figure");
    expect(json.content?.[0]?.attrs).toMatchObject({
      src: "./images/pump.png",
      width: 40,
      layout: "float-left"
    });
    expect(json.content?.[0]?.attrs?.caption).toBe("Schema della pompa.");
    const md = serializeMarkdown({ ast: tiptapToAst(json) });
    expect(md).toMatch(/:width:\s*40%/);
    expect(md).toMatch(/:class:\s*float/);
    expect(md).toContain("Schema della pompa.");
  });

  it("places an image inside a table cell", () => {
    const parsed = parseMarkdown(`| a | b |
| --- | --- |
| x | ![pic](./x.png) |
`);
    const json = astToTiptap(parsed.ast);
    const cell = json.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe("./x.png");
    expect(collectEmptyTextPaths(json)).toEqual([]);
    expect(tiptapDocFromJson(json).childCount).toBe(1);
    const md = serializeMarkdown({ ast: tiptapToAst(json) });
    expect(md).toContain("![pic](./x.png)");
    expect(md).not.toContain("```{image}");
  });
});
