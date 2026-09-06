import { describe, expect, it } from "vitest";
import { astToTiptap } from "./astToTiptap";
import { tiptapToAst } from "./tiptapToAst";

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
});
