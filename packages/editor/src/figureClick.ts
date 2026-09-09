import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { ensureParagraphAfter, exitFigureAfter } from "./figureInsert";
import { collectBlockRects } from "./figureMove";

export function placeCaretInLastParagraph(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const last = state.doc.lastChild;
  if (!last) return false;
  if (last.type.name === "figure" || last.type.name === "pageBreak") {
    return exitFigureAfter(state, dispatch);
  }
  if (last.type.name !== "paragraph") return false;
  const from = state.doc.content.size - last.nodeSize;
  const caret = from + 1 + last.content.size;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, caret)).scrollIntoView());
  return true;
}

/** Click in the empty page past the last block places the caret in a real paragraph. */
export function handleFigureAreaClick(view: EditorView, event: MouseEvent): boolean {
  if (event.target instanceof HTMLElement && event.target.closest(".md-figure")) return false;

  const blocks = collectBlockRects(view);
  const last = blocks[blocks.length - 1];
  if (!last) return false;
  if (event.clientY <= last.bottom + 6) return false;

  const node = view.state.doc.nodeAt(last.pos);
  if (node?.type.name === "figure") {
    let tr = ensureParagraphAfter(view.state.tr, last.pos);
    const figure = tr.doc.nodeAt(last.pos);
    if (!figure) return false;
    const after = last.pos + figure.nodeSize;
    const next = tr.doc.nodeAt(after);
    if (!next || next.type.name !== "paragraph") return false;
    tr = tr.setSelection(TextSelection.create(tr.doc, after + 1));
    view.dispatch(tr.scrollIntoView());
    return true;
  }
  return placeCaretInLastParagraph(view.state, (tr) => view.dispatch(tr));
}
