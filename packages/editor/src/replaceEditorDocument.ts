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

/**
 * Replace the whole document and reset undo/redo (e.g. after open or source sync).
 *
 * `view.updateState` would bypass Tiptap's dispatcher, so listeners that track
 * document changes (re-render, outline/TOC panels) would never learn about the new
 * document. A no-op replace with the same content is dispatched afterwards to
 * publish the change: it emits a normal transaction with `docChanged = true` and
 * stays out of the undo history.
 */
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
  const { size } = editor.state.doc.content;
  const announce = editor.state.tr
    .replaceWith(0, size, editor.state.doc.content)
    .setMeta("addToHistory", false);
  editor.view.dispatch(announce);
}
