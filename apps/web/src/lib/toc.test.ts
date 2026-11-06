import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/react";
import { collectEditorHeadings, jumpToHeading } from "./toc";

type HeadingSpec = { level: number; text: string; empty?: boolean };

type FakeNode = {
  type: { name: string };
  attrs: Record<string, unknown>;
  textContent: string;
  nodeSize: number;
};

/** Minimal ProseMirror-like doc: flat headings whose positions are recorded. */
function fakeEditor(specs: HeadingSpec[]) {
  const nodes: FakeNode[] = [];
  const positions: number[] = [];
  let pos = 0;
  for (const spec of specs) {
    positions.push(pos);
    nodes.push({
      type: { name: "heading" },
      attrs: { level: spec.level },
      textContent: spec.text,
      nodeSize: spec.text.length + 2
    });
    pos += spec.text.length + 2;
  }
  const doc = {
    descendants(callback: (node: FakeNode, pos: number) => boolean | void) {
      nodes.forEach((node, index) => callback(node, positions[index] ?? 0));
    }
  };
  const selected: number[] = [];
  const chain = {
    focus: () => chain,
    setTextSelection: (value: number) => {
      selected.push(value);
      return chain;
    },
    scrollIntoView: () => chain,
    run: () => true
  };
  const editor = {
    state: { doc },
    view: { nodeDOM: () => null },
    chain: () => chain
  } as unknown as Editor;
  return { editor, positions, selected };
}

describe("collectEditorHeadings", () => {
  it("numbers headings to the requested depth", () => {
    const { editor } = fakeEditor([
      { level: 1, text: "Intro" },
      { level: 2, text: "Detail" },
      { level: 1, text: "Next" },
      { level: 4, text: "Deep" }
    ]);
    expect(collectEditorHeadings(editor, 3)).toEqual([
      { depth: 1, text: "Intro", number: "1" },
      { depth: 2, text: "Detail", number: "1.1" },
      { depth: 1, text: "Next", number: "2" }
    ]);
  });

  it("keeps numbering stable around empty headings but hides them", () => {
    const { editor } = fakeEditor([
      { level: 1, text: "   " },
      { level: 1, text: "Intro" },
      { level: 2, text: "" },
      { level: 2, text: "Detail" }
    ]);
    expect(collectEditorHeadings(editor)).toEqual([
      { depth: 1, text: "Intro", number: "2" },
      { depth: 2, text: "Detail", number: "2.2" }
    ]);
  });
});

describe("jumpToHeading", () => {
  it("selects the same heading the outline listed", () => {
    const { editor, positions, selected } = fakeEditor([
      { level: 1, text: "" },
      { level: 1, text: "Intro" },
      { level: 1, text: "Second" }
    ]);
    jumpToHeading(editor, 1);
    expect(selected).toEqual([(positions[2] ?? 0) + 1]);
  });

  it("ignores an index that is out of range", () => {
    const { editor, selected } = fakeEditor([{ level: 1, text: "Only" }]);
    jumpToHeading(editor, 5);
    expect(selected).toEqual([]);
  });
});
