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
});
