import type { EditorView } from "@tiptap/pm/view";

export function domCellAround(target: EventTarget | null): HTMLTableCellElement | null {
  let node = target instanceof Node ? target : null;
  while (node && (node as HTMLElement).nodeName !== "TD" && (node as HTMLElement).nodeName !== "TH") {
    const el = node as HTMLElement;
    if (el.classList?.contains("ProseMirror")) return null;
    node = node.parentNode;
  }
  return node as HTMLTableCellElement | null;
}

/** True when the pointer is on the column-resize handle or within handleWidth px of a cell edge. */
export function isColumnResizeIntent(
  view: EditorView,
  event: MouseEvent,
  handleWidth = 5
): boolean {
  if (event.target instanceof Element && event.target.classList.contains("column-resize-handle")) {
    return true;
  }
  const cell = domCellAround(event.target);
  if (!cell) return false;
  const { left, right } = cell.getBoundingClientRect();
  return event.clientX - left <= handleWidth || right - event.clientX <= handleWidth;
}
