import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { TiptapNode } from "./astToTiptap";

function selectionForDoc(doc: PMNode) {
  if (doc.content.size === 0) return TextSelection.create(doc, 0);
  try {
    return TextSelection.atStart(doc);
  } catch {
    return TextSelection.create(doc, Math.min(1, doc.content.size));
  }
}

/** Replace the whole document and reset undo/redo (e.g. after open or source sync). */
export function replaceEditorDocument(editor: Editor, json: TiptapNode): void {
  const doc = editor.schema.nodeFromJSON(json);
  doc.check();
  const state = EditorState.create({
    doc,
    schema: editor.schema,
    plugins: editor.state.plugins,
    selection: selectionForDoc(doc)
  });
  editor.view.updateState(state);
}
