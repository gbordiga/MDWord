import { NodeSelection, TextSelection, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { figurePosFromState } from "./figurePos";

export type EditorContextKind = "image" | "table" | "text";

export function editorContextKind(state: EditorState): EditorContextKind {
  if (figurePosFromState(state) != null) return "image";
  for (let depth = state.selection.$from.depth; depth > 0; depth -= 1) {
    if (state.selection.$from.node(depth).type.name === "table") return "table";
  }
  return "text";
}

/** Move the caret (or keep a range) so the context menu acts on the click target. */
export function selectAtPointer(view: EditorView, clientX: number, clientY: number): void {
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return;
  const inside = coords.inside >= 0 ? coords.inside : coords.pos;
  const max = view.state.doc.content.size;
  const $pos = view.state.doc.resolve(Math.max(0, Math.min(inside, max)));
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "figure") {
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, $pos.before(depth))));
      return;
    }
  }
  const { from, to } = view.state.selection;
  if (coords.pos >= from && coords.pos <= to && from !== to) return;
  const pos = Math.max(0, Math.min(coords.pos, max));
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}
