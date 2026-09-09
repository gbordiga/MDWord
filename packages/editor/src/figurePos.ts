import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import { figureSelectionKey } from "./figureKeys";

export function figurePosFromSelection(state: EditorState): number | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === "figure") return sel.from;
  for (let depth = sel.$from.depth; depth > 0; depth -= 1) {
    if (sel.$from.node(depth).type.name === "figure") return sel.$from.before(depth);
  }
  return null;
}

export function figurePosFromState(state: EditorState): number | null {
  const fromSel = figurePosFromSelection(state);
  if (fromSel != null && state.doc.nodeAt(fromSel)?.type.name === "figure") return fromSel;
  const stored = figureSelectionKey.getState(state);
  if (stored != null && state.doc.nodeAt(stored)?.type.name === "figure") return stored;
  return null;
}
