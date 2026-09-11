import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { ensureParagraphAfter } from "./figureInsert";
import { collectBlockRects } from "./figureMove";

function lastTextblockEnd(doc: EditorState["doc"]): number | null {
  let end: number | null = null;
  doc.descendants((node, pos) => {
    if (node.isTextblock) end = pos + 1 + node.content.size;
  });
  return end;
}

/** Put the caret at the end of the last writable block (after a figure if needed). */
export function placeCaretAtEnd(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const last = state.doc.lastChild;
  if (!last) return false;
  let tr = state.tr;
  const lastPos = state.doc.content.size - last.nodeSize;
  if (last.type.name === "figure" || last.type.name === "pageBreak") {
    tr = ensureParagraphAfter(tr, lastPos);
  }
  const end = lastTextblockEnd(tr.doc);
  if (end == null) return false;
  tr = tr.setSelection(TextSelection.create(tr.doc, end));
  dispatch?.(tr.scrollIntoView());
  return true;
}

export const placeCaretInLastParagraph = placeCaretAtEnd;

/** Click in the empty page past the last block places the caret where the user can type. */
export function handleFigureAreaClick(view: EditorView, event: MouseEvent): boolean {
  if (event.target instanceof HTMLElement && event.target.closest(".md-figure")) return false;

  const blocks = collectBlockRects(view);
  const last = blocks[blocks.length - 1];
  if (!last) return placeCaretAtEnd(view.state, (tr) => view.dispatch(tr));
  if (event.clientY <= last.bottom + 6) return false;

  return placeCaretAtEnd(view.state, (tr) => view.dispatch(tr));
}

const IGNORE_BLANK_CLICK = "input, textarea, select, button, a, .md-figure, .md-toc, [data-testid=doc-title]";

/**
 * Click on the white page (margins, space below the last line) focuses the editor
 * and puts the caret on that line, or at the end if the click is past the content.
 */
export function focusEditorAtPagePoint(view: EditorView, clientX: number, clientY: number): boolean {
  view.focus();
  const prose = view.dom.getBoundingClientRect();
  if (clientY < prose.top - 2) {
    const start = TextSelection.atStart(view.state.doc);
    view.dispatch(view.state.tr.setSelection(start).scrollIntoView());
    return true;
  }
  if (clientY <= prose.bottom + 8) {
    const left = Math.min(Math.max(clientX, prose.left + 4), Math.max(prose.left + 4, prose.right - 4));
    const hit = view.posAtCoords({ left, top: clientY });
    if (hit) {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, hit.pos)).scrollIntoView());
      return true;
    }
  }
  return placeCaretAtEnd(view.state, (tr) => view.dispatch(tr));
}

export function isBlankPageClickTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".ProseMirror")) return false;
  return !target.closest(IGNORE_BLANK_CLICK);
}
