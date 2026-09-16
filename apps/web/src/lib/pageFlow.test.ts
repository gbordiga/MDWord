import { describe, expect, it } from "vitest";
import { measureEditorFlowHeight } from "./pageFlow";

function el(className: string, height: number, kids: ReturnType<typeof el>[] = []) {
  return {
    classList: { contains: (name: string) => className.split(/\s+/).includes(name) },
    offsetHeight: height,
    children: kids
  };
}

describe("measureEditorFlowHeight", () => {
  it("sums real blocks and ignores page gaps and stretched wrappers", () => {
    const root = el("", 0, [
      el("md-doc-masthead", 40),
      el("md-editor-fill", 900, [
        el("ProseMirror", 900, [el("", 20), el("md-page-gap", 80), el("", 30)])
      ])
    ]);
    expect(measureEditorFlowHeight(root as unknown as HTMLElement)).toBe(90);
  });
});
