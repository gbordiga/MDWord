import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { editorContextKind } from "./contextMenu";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    figure: { group: "block", atom: true },
    table: { group: "block", content: "tableRow+" },
    tableRow: { content: "tableCell+" },
    tableCell: { content: "block+", isolating: true },
    text: {}
  }
});

describe("editorContextKind", () => {
  it("reports text in a paragraph", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("Hi"))]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 2) });
    expect(editorContextKind(state)).toBe("text");
  });

  it("reports table when the caret is in a cell", () => {
    const cell = schema.node("tableCell", null, [schema.node("paragraph", null, schema.text("x"))]);
    const doc = schema.node("doc", null, [
      schema.node("table", null, [schema.node("tableRow", null, [cell])])
    ]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4) });
    expect(editorContextKind(state)).toBe("table");
  });

  it("reports image when a figure is selected", () => {
    const doc = schema.node("doc", null, [schema.node("figure"), schema.node("paragraph")]);
    const state = EditorState.create({
      schema,
      doc,
      selection: NodeSelection.create(doc, 0)
    });
    expect(editorContextKind(state)).toBe("image");
  });
});
