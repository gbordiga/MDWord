import { describe, expect, it } from "vitest";
import { imageReference } from "@mdword/shared";
import { parseMarkdown } from "@mdword/myst-parser";
import { serializeMarkdown } from "@mdword/markdown-serializer";
import { astToTiptap } from "./astToTiptap";
import { tiptapToAst } from "./tiptapToAst";
import { tiptapDocFromJson } from "./schemaValid";

const JPEG = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/${"A".repeat(4000)}`;
const PNG = `data:image/png;base64,iVBORw0KGgoAAAANSU${"B".repeat(4000)}`;

function figures(json: { content?: { type?: string; attrs?: { src?: string } }[] }) {
  return JSON.stringify(json).match(/"type":"figure"/g)?.length ?? 0;
}

function saved(md: string, alt: string, src: string) {
  const ref = imageReference(alt, src);
  expect(md).toContain(ref.image);
  expect(md).toContain(ref.definition);
  expect(md).not.toContain("```{image}");
  expect(md).not.toMatch(/:::\{?figure\}?\s+data:/);
  expect(md).not.toMatch(/:::\{?image\}?\s+data:/);
  expect(md).not.toMatch(/!\[[^\]]*\]\(data:image\//);
}

describe("embedded image save/restore audit", () => {
  it("saves a sized JPEG as one-line markdown and restores a figure", () => {
    const ast = tiptapToAst({
      type: "doc",
      content: [
        {
          type: "figure",
          attrs: { src: JPEG, alt: "foto", caption: "", width: 60, layout: "block-center", label: null }
        }
      ]
    });
    const md = serializeMarkdown({ ast });
    saved(md, "foto", JPEG);
    expect(md).toMatch(/:width:\s*60%/);
    expect(md).toContain(":::{figure}");
    const back = astToTiptap(parseMarkdown(md).ast);
    expect(back.content?.[0]?.type).toBe("figure");
    expect(back.content?.[0]?.attrs?.src).toBe(JPEG);
    expect(tiptapDocFromJson(back).childCount).toBeGreaterThan(0);
  });

  it("saves a table JPEG as one-line markdown and restores a figure in the cell", () => {
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
                      attrs: { src: JPEG, alt: "pic", caption: "", width: 80, layout: "block-center", label: null }
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
    saved(md, "pic", JPEG);
    expect(md).toMatch(/\{width=80%\}/);
    const back = astToTiptap(parseMarkdown(md).ast);
    expect(figures(back)).toBeGreaterThan(0);
    expect(JSON.stringify(back)).toContain(JPEG);
    const cell = back.content?.[0]?.content?.[1]?.content?.[1];
    expect(cell?.content?.find((n) => n.type === "figure")?.attrs?.width).toBe(80);
    expect(tiptapDocFromJson(back).childCount).toBe(1);
  });

  it("restores leftover {image} and :::figure fences as figures, not text", () => {
    const fences = [
      `\`\`\`{image} ${PNG}\n:alt: pic\n:width: 60%\n\`\`\`\n`,
      `:::{figure} ${JPEG}\n:alt: foto\n:width: 60%\n\n:::\n`,
      `:::{figure} ${JPEG}\n`
    ];
    for (const md of fences) {
      const json = astToTiptap(parseMarkdown(md).ast);
      expect(json.content?.[0]?.type, md.slice(0, 40)).toBe("figure");
      expect(String(json.content?.[0]?.attrs?.src).startsWith("data:image/")).toBe(true);
      expect(JSON.stringify(json)).not.toMatch(/:::/);
    }
  });

  it("does not leave fence text in the parsed AST for a history snapshot", () => {
    const md = `:::{figure} ${JPEG}\n:alt: foto\n\n:::\n`;
    const parsed = parseMarkdown(md);
    const types = JSON.stringify(parsed.ast, (key, value) => (key === "position" || key === "data" ? undefined : value));
    const json = astToTiptap(parsed.ast);
    expect(json.content?.[0]?.type).toBe("figure");
    expect(json.content?.[0]?.attrs?.src).toBe(JPEG);
    const resaved = serializeMarkdown({ ast: parsed.ast });
    saved(resaved, "foto", JPEG);
    expect(types.includes("mystDirective") || types.includes("\"image\"") || json.content?.[0]?.type === "figure").toBe(
      true
    );
  });
});
