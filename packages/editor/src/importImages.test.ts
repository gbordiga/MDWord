import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { history, undo, undoDepth } from "@tiptap/pm/history";
import { describe, expect, it } from "vitest";
import { applyFigureSources, collectEditorExternalFigures } from "./importImages";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    figure: { group: "block", atom: true, attrs: { src: { default: "" }, alt: { default: "" } } },
    text: {}
  }
});

const PNG = "data:image/png;base64,AAAA";

function editorWith(doc: ReturnType<typeof schema.node>) {
  let state = EditorState.create({ schema, plugins: [history()], doc });
  return {
    get state() {
      return state;
    },
    view: {
      dispatch(tr: ReturnType<typeof state.tr>) {
        state = state.apply(tr);
      }
    }
  };
}

describe("importImages", () => {
  it("collects file-backed figures and applies one undoable replacement", () => {
    const doc = schema.node("doc", null, [
      schema.node("figure", { src: "./foto.png", alt: "x" }),
      schema.node("figure", { src: PNG, alt: "embedded" }),
      schema.node("paragraph")
    ]);
    const editor = editorWith(doc);
    expect(collectEditorExternalFigures(editor as never)).toEqual([{ pos: 0, src: "./foto.png" }]);

    expect(applyFigureSources(editor as never, [{ pos: 0, src: PNG }])).toBe(true);
    expect(editor.state.doc.nodeAt(0)?.attrs.src).toBe(PNG);
    expect(undoDepth(editor.state)).toBe(1);

    expect(undo(editor.state, (tr) => editor.view.dispatch(tr))).toBe(true);
    expect(editor.state.doc.nodeAt(0)?.attrs.src).toBe("./foto.png");
  });
});
