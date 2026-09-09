import { describe, expect, it } from "vitest";
import { exitFigureAfter, insertRangeForFigure, needsTrailingWritable } from "./figureInsert";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    figure: { group: "block", atom: true },
    pageBreak: { group: "block", atom: true },
    text: {}
  }
});

function stateWith(doc: ReturnType<typeof schema.node>) {
  return EditorState.create({ schema, doc });
}

describe("figure insert helpers", () => {
  it("replaces an empty paragraph and appends after a filled one", () => {
    const empty = stateWith(schema.node("doc", null, [schema.node("paragraph")]));
    expect(insertRangeForFigure(empty, 1)).toEqual({ from: 0, to: 2 });

    const filled = stateWith(schema.node("doc", null, [schema.node("paragraph", null, schema.text("Hi"))]));
    expect(insertRangeForFigure(filled, 2)).toEqual({ from: 4, to: 4 });
  });

  it("asks for a writable block after a trailing figure", () => {
    const fig = schema.node("doc", null, [schema.node("figure")]);
    expect(needsTrailingWritable(fig)).toBe(true);
    const withPara = schema.node("doc", null, [schema.node("figure"), schema.node("paragraph")]);
    expect(needsTrailingWritable(withPara)).toBe(false);
  });

  it("does not steal Enter after the caret has left the figure", () => {
    const doc = schema.node("doc", null, [schema.node("figure"), schema.node("paragraph")]);
    const atPara = EditorState.create({
      schema,
      doc,
      selection: TextSelection.create(doc, doc.content.size - 1)
    });
    expect(exitFigureAfter(atPara)).toBe(false);
    const onFigure = EditorState.create({
      schema,
      doc,
      selection: NodeSelection.create(doc, 0)
    });
    expect(exitFigureAfter(onFigure)).toBe(true);
  });
});
