import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection } from "@tiptap/pm/state";
import {
  dropPosFromBlockRects,
  isNoopFigureMove,
  mappedInsertAfterDelete,
  moveFigureBy,
  resolveFigureInsertAt
} from "./figureMove";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    figure: { group: "block", atom: true },
    text: {}
  }
});

describe("mappedInsertAfterDelete", () => {
  it("shifts the drop point backward when the figure is removed from before it", () => {
    expect(mappedInsertAfterDelete(10, 5, 40)).toBe(35);
  });

  it("keeps a drop before the figure in place", () => {
    expect(mappedInsertAfterDelete(10, 5, 4)).toBe(4);
  });

  it("does not place the figure over itself", () => {
    expect(mappedInsertAfterDelete(10, 5, 12)).toBe(10);
  });
});

describe("dropPosFromBlockRects", () => {
  const blocks = [
    { pos: 0, end: 10, top: 0, bottom: 100 },
    { pos: 10, end: 40, top: 100, bottom: 400 },
    { pos: 40, end: 50, top: 400, bottom: 460 }
  ];

  it("drops before the first block above it", () => {
    expect(dropPosFromBlockRects(blocks, -10)).toBe(0);
  });

  it("uses the top half of a block as before, bottom half as after", () => {
    expect(dropPosFromBlockRects(blocks, 20)).toBe(0);
    expect(dropPosFromBlockRects(blocks, 80)).toBe(10);
    expect(dropPosFromBlockRects(blocks, 249)).toBe(10);
    expect(dropPosFromBlockRects(blocks, 350)).toBe(40);
  });

  it("drops after the last block below it", () => {
    expect(dropPosFromBlockRects(blocks, 500)).toBe(50);
  });

  it("treats before/after the same figure as a no-op", () => {
    expect(isNoopFigureMove(10, 30, 10)).toBe(true);
    expect(isNoopFigureMove(10, 30, 40)).toBe(true);
    expect(isNoopFigureMove(10, 30, 0)).toBe(false);
    expect(isNoopFigureMove(10, 30, 50)).toBe(false);
  });

  it("moves a figure back above the previous paragraph on a second drop", () => {
    const afterMove = [
      { pos: 0, end: 10, top: 0, bottom: 40 },
      { pos: 10, end: 40, top: 40, bottom: 340 }
    ];
    expect(resolveFigureInsertAt(afterMove, 10, 30, 30)).toBe(0);
    expect(resolveFigureInsertAt(afterMove, 10, 30, 10)).toBe(0);
  });

  it("moves a figure past the following paragraph even on that paragraph's top half", () => {
    const beforeMove = [
      { pos: 0, end: 30, top: 0, bottom: 300 },
      { pos: 30, end: 40, top: 300, bottom: 340 }
    ];
    expect(resolveFigureInsertAt(beforeMove, 0, 30, 310)).toBe(40);
    expect(resolveFigureInsertAt(beforeMove, 0, 30, 335)).toBe(40);
  });
});

describe("moveFigureBy", () => {
  it("moves a figure past the following paragraph", () => {
    const doc = schema.node("doc", null, [
      schema.node("figure"),
      schema.node("paragraph", null, schema.text("Hi"))
    ]);
    const state = EditorState.create({ schema, doc, selection: NodeSelection.create(doc, 0) });
    let next = state;
    expect(moveFigureBy(state, 0, 1, (tr) => {
      next = state.apply(tr);
    })).toBe(true);
    expect(next.doc.firstChild?.type.name).toBe("paragraph");
    expect(next.doc.lastChild?.type.name).toBe("figure");
  });
});
