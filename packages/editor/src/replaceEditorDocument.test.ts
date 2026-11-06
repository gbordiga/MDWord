import type { Editor } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { history, undoDepth } from "@tiptap/pm/history";
import { describe, expect, it } from "vitest";
import { replaceEditorDocument } from "./replaceEditorDocument";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    text: { inline: true }
  }
});

const plugins = [history()];

function document(text: string) {
  return schema.node("doc", null, [schema.node("paragraph", null, [schema.text(text)])]);
}

/** Minimal stand-in for a TipTap editor: state, schema and a dispatching view. */
function fakeEditor(initial: string) {
  let state = EditorState.create({ schema, plugins, doc: document(initial) });
  // Give the history plugin something to undo before the replacement.
  state = state.apply(state.tr.insertText(" edited"));
  const dispatched: { docChanged: boolean; addToHistory: unknown; text: string }[] = [];
  const editor = {
    schema,
    get state() {
      return state;
    },
    view: {
      updateState(next: EditorState) {
        state = next;
      },
      dispatch(transaction: typeof state.tr) {
        dispatched.push({
          docChanged: transaction.docChanged,
          addToHistory: transaction.getMeta("addToHistory"),
          text: transaction.doc.textContent
        });
        state = state.apply(transaction);
      }
    }
  };
  return { editor: editor as unknown as Editor, state: () => state, dispatched };
}

describe("replaceEditorDocument", () => {
  it("replaces the document and resets undo depth", () => {
    const { editor, state } = fakeEditor("before");
    expect(undoDepth(state())).toBeGreaterThan(0);

    replaceEditorDocument(editor, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "after open" }] }]
    });

    expect(state().doc.textContent).toBe("after open");
    expect(undoDepth(state())).toBe(0);
  });

  it("announces the new document as a change outside the undo history", () => {
    const { editor, state, dispatched } = fakeEditor("before");

    replaceEditorDocument(editor, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "after open" }] }]
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.docChanged).toBe(true);
    expect(dispatched[0]?.addToHistory).toBe(false);
    expect(dispatched[0]?.text).toBe("after open");
    expect(state().doc.textContent).toBe("after open");
    expect(undoDepth(state())).toBe(0);
  });
});
