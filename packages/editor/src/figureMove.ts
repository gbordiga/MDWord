import { NodeSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export type BlockRect = { pos: number; end: number; top: number; bottom: number };

/** Insert position from vertical block geometry — not posAtCoords, which sticks to a tall image. */
export function dropPosFromBlockRects(blocks: BlockRect[], clientY: number): number | null {
  const first = blocks[0];
  if (!first) return null;
  if (clientY < first.top) return first.pos;
  for (const block of blocks) {
    const mid = (block.top + block.bottom) / 2;
    if (clientY < mid) return block.pos;
    if (clientY <= block.bottom) return block.end;
  }
  return blocks[blocks.length - 1]?.end ?? null;
}

function nearestBlock(blocks: BlockRect[], clientY: number): BlockRect | null {
  let best: BlockRect | null = null;
  let bestDist = Infinity;
  for (const block of blocks) {
    const mid = (block.top + block.bottom) / 2;
    const dist =
      clientY < block.top ? block.top - clientY : clientY > block.bottom ? clientY - block.bottom : Math.abs(clientY - mid);
    if (dist < bestDist) {
      best = block;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Drop slot for a moving figure. The figure itself is ignored so releasing on the
 * neighboring paragraph (the usual second drop) is not treated as a no-op.
 */
export function resolveFigureInsertAt(
  blocks: BlockRect[],
  fromPos: number,
  nodeSize: number,
  clientY: number
): number | null {
  const others = blocks.filter((block) => block.pos !== fromPos);
  const insertAt = dropPosFromBlockRects(others.length ? others : blocks, clientY);
  if (insertAt == null) return null;
  if (!isNoopFigureMove(fromPos, nodeSize, insertAt)) return insertAt;
  const nearest = nearestBlock(others, clientY);
  if (!nearest) return null;
  const mid = (nearest.top + nearest.bottom) / 2;
  const preferred = clientY < mid ? nearest.pos : nearest.end;
  const flipped = preferred === nearest.pos ? nearest.end : nearest.pos;
  if (!isNoopFigureMove(fromPos, nodeSize, preferred)) return preferred;
  if (!isNoopFigureMove(fromPos, nodeSize, flipped)) return flipped;
  return null;
}

export function isNoopFigureMove(from: number, nodeSize: number, insertAt: number): boolean {
  return insertAt === from || insertAt === from + nodeSize;
}

export function mappedInsertAfterDelete(from: number, nodeSize: number, insertAt: number): number {
  if (insertAt > from) return Math.max(from, insertAt - nodeSize);
  return insertAt;
}

export function collectBlockRects(view: EditorView): BlockRect[] {
  const blocks: BlockRect[] = [];
  view.state.doc.forEach((node, pos) => {
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement) || dom.classList.contains("md-page-gap")) return;
    const rect = dom.getBoundingClientRect();
    if (rect.height <= 0) return;
    blocks.push({ pos, end: pos + node.nodeSize, top: rect.top, bottom: rect.bottom });
  });
  return blocks;
}

export function figureDropPos(
  view: EditorView,
  fromPos: number,
  nodeSize: number,
  _clientX: number,
  clientY: number
): number | null {
  return resolveFigureInsertAt(collectBlockRects(view), fromPos, nodeSize, clientY);
}

export function dropMarkY(blocks: BlockRect[], insertAt: number): number | null {
  for (const block of blocks) {
    if (insertAt === block.pos) return block.top;
    if (insertAt === block.end) return block.bottom;
  }
  return null;
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
  const blocks = collectBlockRects(view);
  const insertAt = resolveFigureInsertAt(blocks, fromPos, nodeSize, clientY);
  if (insertAt == null) {
    dropMark?.remove();
    return;
  }
  const y = dropMarkY(blocks, insertAt);
  if (y == null) {
    dropMark?.remove();
    return;
  }
  if (!dropMark) {
    dropMark = document.createElement("div");
    dropMark.className = "md-figure-drop-mark";
    dropMark.dataset.testid = "figure-drop-mark";
  }
  const box = view.dom.getBoundingClientRect();
  dropMark.style.top = `${Math.round(y)}px`;
  dropMark.style.left = `${Math.round(box.left)}px`;
  dropMark.style.width = `${Math.round(Math.max(48, box.width))}px`;
  if (!dropMark.isConnected) document.body.append(dropMark);
  void clientX;
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
  const dest = mappedInsertAfterDelete(fromPos, node.nodeSize, insertAt);
  if (isNoopFigureMove(fromPos, node.nodeSize, insertAt)) return false;
  const tr = view.state.tr.delete(fromPos, fromPos + node.nodeSize);
  const safe = Math.max(0, Math.min(dest, tr.doc.content.size));
  tr.insert(safe, node);
  if (tr.doc.nodeAt(safe)?.type.name === "figure") {
    tr.setSelection(NodeSelection.create(tr.doc, safe));
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function moveFigureBy(
  state: EditorState,
  fromPos: number,
  direction: -1 | 1,
  dispatch?: (tr: Transaction) => void
): boolean {
  const node = state.doc.nodeAt(fromPos);
  if (!node || node.type.name !== "figure") return false;
  let insertAt: number | null = null;
  state.doc.forEach((child, pos) => {
    if (direction < 0 && pos + child.nodeSize === fromPos) insertAt = pos;
    if (direction > 0 && pos === fromPos + node.nodeSize) insertAt = pos + child.nodeSize;
  });
  if (insertAt == null) return false;
  const dest = mappedInsertAfterDelete(fromPos, node.nodeSize, insertAt);
  const tr = state.tr.delete(fromPos, fromPos + node.nodeSize);
  const safe = Math.max(0, Math.min(dest, tr.doc.content.size));
  tr.insert(safe, node);
  if (tr.doc.nodeAt(safe)?.type.name === "figure") {
    tr.setSelection(NodeSelection.create(tr.doc, safe));
  }
  dispatch?.(tr.scrollIntoView());
  return true;
}
