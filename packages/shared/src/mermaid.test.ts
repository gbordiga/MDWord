import { describe, expect, it } from "vitest";
import { isMermaidAstNode, isMermaidLanguage, mermaidSourceFromNode } from "./mermaid";

describe("mermaid helpers", () => {
  it("recognizes mermaid fence languages", () => {
    expect(isMermaidLanguage("mermaid")).toBe(true);
    expect(isMermaidLanguage("MMD")).toBe(true);
    expect(isMermaidLanguage("javascript")).toBe(false);
  });

  it("reads source from code, directive, and mermaid nodes", () => {
    const source = "flowchart TB\n  A --> B";
    expect(mermaidSourceFromNode({ type: "code", lang: "mermaid", value: source })).toBe(source);
    expect(mermaidSourceFromNode({ type: "mystDirective", name: "mermaid", value: source })).toBe(source);
    expect(
      mermaidSourceFromNode({
        type: "mermaid",
        children: [{ type: "text", value: "flowchart TB\n  A --> B" }]
      })
    ).toBe(source);
  });

  it("detects mermaid AST nodes", () => {
    expect(isMermaidAstNode({ type: "code", lang: "mermaid", value: "A" })).toBe(true);
    expect(isMermaidAstNode({ type: "mystDirective", name: "mermaid", value: "A" })).toBe(true);
    expect(isMermaidAstNode({ type: "code", lang: "ts", value: "A" })).toBe(false);
  });
});
