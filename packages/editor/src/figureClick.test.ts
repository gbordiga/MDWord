import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { placeCaretAtEnd, placeCaretInLastParagraph } from "./figureClick";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    heading: { group: "block", content: "text*", attrs: { level: { default: 1 } } },
    figure: { group: "block", atom: true },
    text: {}
  }
});

describe("placeCaretAtEnd", () => {
  it("moves the caret into the last paragraph", () => {
    const doc = schema.node("doc", null, [
      schema.node("figure"),
      schema.node("paragraph", null, schema.text("Hi"))
    ]);
    const state = EditorState.create({
      schema,
      doc,
      selection: TextSelection.create(doc, 2)
    });
    let next = state;
    const ok = placeCaretInLastParagraph(state, (tr) => {
      next = state.apply(tr);
    });
    expect(ok).toBe(true);
    expect(next.selection.from).toBe(doc.content.size - 1);
  });

  it("moves the caret to the end of a trailing heading", () => {
    const doc = schema.node("doc", null, [schema.node("heading", { level: 1 }, schema.text("Title"))]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 1) });
    let next = state;
    expect(placeCaretAtEnd(state, (tr) => {
      next = state.apply(tr);
    })).toBe(true);
    expect(next.selection.from).toBe(doc.content.size - 1);
  });

  it("appends a paragraph after a trailing figure", () => {
    const doc = schema.node("doc", null, [schema.node("figure")]);
    const state = EditorState.create({ schema, doc });
    let next = state;
    expect(placeCaretAtEnd(state, (tr) => {
      next = state.apply(tr);
    })).toBe(true);
    expect(next.doc.lastChild?.type.name).toBe("paragraph");
    expect(next.selection.$from.parent.type.name).toBe("paragraph");
  });
});

describe("placeCaretInLastParagraph", () => {
  it("keeps the previous helper name", () => {
    expect(placeCaretInLastParagraph).toBe(placeCaretAtEnd);
  });
});
