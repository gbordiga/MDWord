import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { history, undoDepth } from "@tiptap/pm/history";
import { describe, expect, it } from "vitest";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    text: { inline: true }
  }
});

const plugins = [history()];

describe("replaceEditorDocument", () => {
  it("resets undo depth when recreating editor state for a new document", () => {
    let state = EditorState.create({
      schema,
      plugins,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("before")])])
    });
    state = state.apply(state.tr.insertText(" edited"));
    expect(undoDepth(state)).toBeGreaterThan(0);

    const nextDoc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("after open")])]);
    state = EditorState.create({ schema, plugins, doc: nextDoc });
    expect(state.doc.textContent).toBe("after open");
    expect(undoDepth(state)).toBe(0);
  });
});
