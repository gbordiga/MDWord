import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Block position to drop a figure, or null when the point is still on the same node. */
export function figureDropPos(
  view: EditorView,
  fromPos: number,
  nodeSize: number,
  clientX: number,
  clientY: number
): number | null {
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return null;
  const size = view.state.doc.content.size;
  const pos = Math.max(1, Math.min(coords.pos, size));
  if (pos >= fromPos && pos <= fromPos + nodeSize) return null;
  const $pos = view.state.doc.resolve(pos);
  if ($pos.parent.inlineContent) return $pos.after($pos.depth);
  return $pos.pos;
}

export function mappedInsertAfterDelete(from: number, nodeSize: number, insertAt: number): number {
  if (insertAt > from) return Math.max(from, insertAt - nodeSize);
  return insertAt;
}

let dropMark: HTMLElement | null = null;

export function clearFigureDropMark(): void {
  dropMark?.remove();
}

export function updateFigureDropMark(
  view: EditorView,
  fromPos: number,
  nodeSize: number,
  clientX: number,
  clientY: number
): void {
  const insertAt = figureDropPos(view, fromPos, nodeSize, clientX, clientY);
  if (insertAt == null) {
    clearFigureDropMark();
    return;
  }
  let coords: { left: number; right: number; top: number } | null = null;
  try {
    coords = view.coordsAtPos(insertAt);
  } catch {
    clearFigureDropMark();
    return;
  }
  if (!dropMark) {
    dropMark = document.createElement("div");
    dropMark.className = "md-figure-drop-mark";
    dropMark.dataset.testid = "figure-drop-mark";
  }
  const width = Math.max(48, Math.min(view.dom.getBoundingClientRect().width, 420));
  dropMark.style.top = `${Math.round(coords.top)}px`;
  dropMark.style.left = `${Math.round(coords.left)}px`;
  dropMark.style.width = `${Math.round(width)}px`;
  if (!dropMark.isConnected) document.body.append(dropMark);
}

export function moveFigureTo(
  view: EditorView,
  fromPos: number,
  clientX: number,
  clientY: number
): boolean {
  const node = view.state.doc.nodeAt(fromPos);
  if (!node || node.type.name !== "figure") return false;
  const insertAt = figureDropPos(view, fromPos, node.nodeSize, clientX, clientY);
  if (insertAt == null) return false;
  const mapped = mappedInsertAfterDelete(fromPos, node.nodeSize, insertAt);
  if (mapped >= fromPos && mapped <= fromPos + node.nodeSize) return false;
  const tr = view.state.tr.delete(fromPos, fromPos + node.nodeSize);
  const dest = Math.max(0, Math.min(tr.mapping.map(insertAt, insertAt > fromPos ? -1 : 1), tr.doc.content.size));
  tr.insert(dest, node);
  if (tr.doc.nodeAt(dest)?.type.name === "figure") {
    tr.setSelection(NodeSelection.create(tr.doc, dest));
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}
