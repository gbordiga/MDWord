import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { placeCaretInLastParagraph } from "./figureClick";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    figure: { group: "block", atom: true },
    text: {}
  }
});

describe("placeCaretInLastParagraph", () => {
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
});
