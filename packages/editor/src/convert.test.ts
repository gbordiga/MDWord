import { describe, expect, it } from "vitest";
import { astToTiptap } from "./astToTiptap";
import { tiptapToAst } from "./tiptapToAst";
import { collectEmptyTextPaths, tiptapDocFromJson } from "./schemaValid";
import { imageReference } from "@mdword/shared";
import { parseMarkdown } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";
import { displayImageSrc } from "./imageDisplay";

function expectEmbedded(md: string, alt: string, src: string) {
  const ref = imageReference(alt, src);
  expect(md).toContain(ref.image);
  expect(md).toContain(ref.definition);
  expect(md).not.toContain("```{image}");
}

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
    expect(json.content?.[0]?.attrs?.alt).toBe("Schema della pompa.");
    const md = serializeMarkdown({ ast: tiptapToAst(json) });
    expect(md).toMatch(/:width:\s*40%/);
    expect(md).toMatch(/:class:\s*float/);
    expect(md).toContain("Schema della pompa.");
  });

  it("persists embedded width, float and caption around a CommonMark reference", () => {
    const src = `data:image/jpeg;base64,/9j/${"A".repeat(80)}`;
    const ast = tiptapToAst({
      type: "doc",
      content: [
        {
          type: "figure",
          attrs: {
            src,
            alt: "Schema della pompa.",
            caption: "Schema della pompa.",
            width: 40,
            layout: "float-left",
            label: null
          }
        }
      ]
    });
    const md = serializeMarkdown({ ast });
    const ref = imageReference("Schema della pompa.", src);
    expect(md).toContain(ref.image);
    expect(md).toContain(ref.definition);
    expect(md).toMatch(/:width:\s*40%/);
    expect(md).toMatch(/:class:\s*float/);
    expect(md).not.toMatch(/:::\{figure\} data:/);
    expect(md).not.toMatch(/\[img-[^\]]+\]: data:image\/[^\n]+ "/);
    const back = astToTiptap(parseMarkdown(md).ast);
    expect(back.content?.[0]?.type).toBe("figure");
    expect(back.content?.[0]?.attrs).toMatchObject({
      src,
      alt: "Schema della pompa.",
      caption: "Schema della pompa.",
      width: 40,
      layout: "float-left"
    });
  });

  it("loads a leftover imageReference tree without going through parse", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const json = astToTiptap({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "imageReference", identifier: "img-x", label: "img-x", alt: "pic" }]
        },
        { type: "definition", identifier: "img-x", label: "img-x", url: src }
      ]
    });
    const figure = json.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(figure?.attrs?.alt).toBe("pic");
  });

  it("loads a reference-style figure into the visual document", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseMarkdown(`# Title

:::{figure}
:width: 40%

![pic][img-x]
:::

[img-x]: ${src}
`);
    const json = astToTiptap(parsed.ast);
    expect(json.content?.some((n) => n.type === "heading")).toBe(true);
    const figure = json.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(figure?.attrs?.alt).toBe("pic");
    expect(() => serializeMarkdown({ ast: parsed.ast })).not.toThrow();
  });

  it("restores table image width from a reference attr list", () => {
    const src = `data:image/png;base64,${"C".repeat(80)}`;
    const ref = imageReference("pic", src);
    const parsed = parseMarkdown(`| a | b |
| --- | --- |
| x | ${ref.image}{width=40%} |

${ref.definition}
`);
    const json = astToTiptap(parsed.ast);
    const cell = json.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(figure?.attrs?.width).toBe(40);
    const md = serializeMarkdown({ ast: tiptapToAst(json) });
    expect(md).toContain(`${ref.image}{width=40%}`);
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

  it("keeps a real PNG data-URL in a table as a one-line image", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseMarkdown(`| a | b |
| --- | --- |
| x | ![pic](${src}) |
`);
    const md = serializeMarkdown({ ast: tiptapToAst(astToTiptap(parsed.ast)) });
    expectEmbedded(md, "pic", src);
    expect(md).not.toContain("{image}");
    expect(md).not.toContain("<img");
    expect(md.split("\n").some((line) => line.includes("![pic]") && line.includes("|"))).toBe(true);
  });

  it("keeps a sized data-URL figure in a table as markdown", () => {
    const src = `data:image/png;base64,${"A".repeat(80)}`;
    const json = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] }
              ]
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "figure",
                      attrs: {
                        src,
                        alt: "pic",
                        caption: "",
                        width: 60,
                        layout: "block-center",
                        label: null
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    const ast = tiptapToAst(json);
    const md = serializeMarkdown({ ast });
    expectEmbedded(md, "pic", src);
    expect(md).not.toContain("<img");
    expect(md).toMatch(/\{width=60%\}/);
    expect(md).not.toContain("{image}");
    const back = astToTiptap(parseMarkdown(md).ast);
    const cell = back.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(figure?.attrs?.width).toBe(60);
  });

  it("round-trips a long table photo through save and restore", () => {
    const src = `data:image/png;base64,${"B".repeat(2400)}`;
    const json = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] }
              ]
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "figure",
                      attrs: {
                        src,
                        alt: "pic",
                        caption: "",
                        width: 100,
                        layout: "block-center",
                        label: null
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    expect(tiptapDocFromJson(json).childCount).toBe(1);
    const md = serializeMarkdown({ ast: tiptapToAst(json) });
    expectEmbedded(md, "pic", src);
    expect(md).not.toContain("{image}");
    const restored = astToTiptap(parseMarkdown(md).ast);
    const cell = restored.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(tiptapDocFromJson(restored).childCount).toBe(1);
  });

  it("does not persist a display blob URL from a table figure", () => {
    const src = `data:image/png;base64,${"E".repeat(80)}`;
    const blob = displayImageSrc(src);
    const json = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] }
              ]
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "figure",
                      attrs: {
                        src: blob,
                        alt: "pic",
                        caption: "",
                        width: 100,
                        layout: "block-center",
                        label: null
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    const md = serializeMarkdown({ ast: tiptapToAst(json) });
    expectEmbedded(md, "pic", src);
    expect(md).not.toContain("blob:");
    const restored = astToTiptap(parseMarkdown(`| a | b |\n| --- | --- |\n| x | ${blob} |\n`).ast);
    const cell = restored.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
  });

  it("recovers a leftover {image} fence parsed from markdown", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const md = `| a | b |
| - | --- |
| x | \`\`\`{image} ${src}
:alt: pic
\`\`\` |
`;
    const json = astToTiptap(parseMarkdown(md).ast);
    const table = json.content?.find((n) => n.type === "table");
    const figures = JSON.stringify(table).match(/"type":"figure"/g) ?? [];
    expect(figures.length).toBeGreaterThan(0);
    expect(JSON.stringify(table)).toContain(src);
  });

  it("recovers a leftover {image} fence in a table cell", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const json = astToTiptap({
      type: "root",
      children: [
        {
          type: "table",
          children: [
            {
              type: "tableRow",
              children: [
                { type: "tableCell", header: true, children: [{ type: "paragraph", children: [{ type: "text", value: "a" }] }] },
                { type: "tableCell", header: true, children: [{ type: "paragraph", children: [{ type: "text", value: "b" }] }] }
              ]
            },
            {
              type: "tableRow",
              children: [
                { type: "tableCell", children: [{ type: "paragraph", children: [{ type: "text", value: "x" }] }] },
                {
                  type: "tableCell",
                  children: [
                    {
                      type: "paragraph",
                      children: [
                        { type: "text", value: `\`\`\`{image} ${src}` },
                        { type: "text", value: ":alt: pic" }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    const cell = json.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(figure?.attrs?.alt).toBe("pic");
  });

  it("restores a leftover {image} fence shown as text or a code block", () => {
    const src = `data:image/png;base64,${"iVBORw0KGgoAAAANSU"}${"B".repeat(80)}`;
    const asText = astToTiptap({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: `\`\`\`{image} ${src}` }] },
        { type: "paragraph", children: [{ type: "text", value: ":alt: pic" }] },
        { type: "paragraph", children: [{ type: "text", value: "```" }] }
      ]
    });
    expect(asText.content?.[0]?.type).toBe("figure");
    expect(asText.content?.[0]?.attrs?.src).toBe(src);
    const asCode = astToTiptap({
      type: "root",
      children: [{ type: "code", lang: `{image} ${src}`, value: ":alt: pic" }]
    });
    expect(asCode.content?.[0]?.type).toBe("figure");
    expect(asCode.content?.[0]?.attrs?.src).toBe(src);
    const asColon = astToTiptap({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: `:::{figure} ${src}` }] },
        { type: "paragraph", children: [{ type: "text", value: ":alt: pic" }] },
        { type: "paragraph", children: [{ type: "text", value: ":::" }] }
      ]
    });
    expect(asColon.content?.[0]?.type).toBe("figure");
    expect(asColon.content?.[0]?.attrs?.src).toBe(src);
  });

  it("recovers an HTML img left in a table cell", () => {
    const src = `data:image/png;base64,${"D".repeat(80)}`;
    const json = astToTiptap({
      type: "root",
      children: [
        {
          type: "table",
          children: [
            {
              type: "tableRow",
              children: [
                { type: "tableCell", header: true, children: [{ type: "paragraph", children: [{ type: "text", value: "a" }] }] },
                { type: "tableCell", header: true, children: [{ type: "paragraph", children: [{ type: "text", value: "b" }] }] }
              ]
            },
            {
              type: "tableRow",
              children: [
                { type: "tableCell", children: [{ type: "paragraph", children: [{ type: "text", value: "x" }] }] },
                {
                  type: "tableCell",
                  children: [
                    {
                      type: "paragraph",
                      children: [
                        {
                          type: "html",
                          value: `<img src="${src}" alt="old" width="60%" class="md-layout-block-center" />`
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    const cell = json.content?.[0]?.content?.[1]?.content?.[1];
    const figure = cell?.content?.find((n) => n.type === "figure");
    expect(figure?.attrs?.src).toBe(src);
    expect(figure?.attrs?.alt).toBe("old");
  });
});
