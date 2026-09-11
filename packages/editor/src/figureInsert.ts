import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as ProseNode } from "@tiptap/pm/model";
import {
  clampImageWidth,
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  isImageLayout,
  type FigureAttrs
} from "./imageModel";
import { figurePosFromSelection } from "./figurePos";

export function createFigureNode(state: EditorState, attrs: Partial<FigureAttrs> & { src: string }): ProseNode | null {
  const type = state.schema.nodes.figure;
  if (!type) return null;
  const text = String(attrs.caption ?? attrs.alt ?? "").trim();
  return type.createAndFill({
    src: attrs.src,
    alt: text,
    caption: text,
    width: clampImageWidth(Number(attrs.width ?? DEFAULT_IMAGE_WIDTH)),
    layout: isImageLayout(attrs.layout) ? attrs.layout : DEFAULT_IMAGE_LAYOUT,
    label: attrs.label ?? null
  });
}

export function insertRangeForFigure(state: EditorState, pos: number): { from: number; to: number } {
  const $pos = state.doc.resolve(Math.min(Math.max(0, pos), state.doc.content.size));
  if ($pos.parent.inlineContent) {
    const start = $pos.before($pos.depth);
    const end = $pos.after($pos.depth);
    if ($pos.parent.content.size === 0) return { from: start, to: end };
    return { from: end, to: end };
  }
  return { from: $pos.pos, to: $pos.pos };
}

export function ensureParagraphAfter(tr: Transaction, blockPos: number): Transaction {
  const node = tr.doc.nodeAt(blockPos);
  if (!node || (node.type.name !== "figure" && node.type.name !== "pageBreak")) return tr;
  const after = blockPos + node.nodeSize;
  const next = after < tr.doc.content.size ? tr.doc.nodeAt(after) : null;
  if (next?.type.name === "paragraph") return tr;
  const paragraph = tr.doc.type.schema.nodes.paragraph?.create();
  if (!paragraph) return tr;
  return tr.insert(after, paragraph);
}

export function ensureParagraphBefore(tr: Transaction, figurePos: number): Transaction {
  const figure = tr.doc.nodeAt(figurePos);
  if (!figure || figure.type.name !== "figure") return tr;
  if (figurePos === 0) {
    const paragraph = tr.doc.type.schema.nodes.paragraph?.create();
    return paragraph ? tr.insert(0, paragraph) : tr;
  }
  const prev = tr.doc.resolve(figurePos).nodeBefore;
  if (prev?.type.name === "paragraph") return tr;
  const paragraph = tr.doc.type.schema.nodes.paragraph?.create();
  if (!paragraph) return tr;
  return tr.insert(figurePos, paragraph);
}

export function insertFigureTransaction(state: EditorState, pos: number, attrs: Partial<FigureAttrs> & { src: string }): Transaction | null {
  const node = createFigureNode(state, attrs);
  if (!node) return null;
  const range = insertRangeForFigure(state, pos);
  let tr = state.tr.replaceWith(range.from, range.to, node);
  const figurePos = range.from;
  tr = ensureParagraphAfter(tr, figurePos);
  if (tr.doc.nodeAt(figurePos)?.type.name === "figure") {
    tr.setSelection(NodeSelection.create(tr.doc, figurePos));
  }
  return tr.scrollIntoView();
}

export function exitFigureAfter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const pos = figurePosFromSelection(state);
  if (pos == null) return false;
  let tr = ensureParagraphAfter(state.tr, pos);
  const figure = tr.doc.nodeAt(pos);
  if (!figure) return false;
  const after = pos + figure.nodeSize;
  const next = tr.doc.nodeAt(after);
  if (!next || next.type.name !== "paragraph") return false;
  tr = tr.setSelection(TextSelection.create(tr.doc, after + 1));
  dispatch?.(tr.scrollIntoView());
  return true;
}

export function exitFigureBefore(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const pos = figurePosFromSelection(state);
  if (pos == null) return false;
  let tr = state.tr;
  tr = ensureParagraphBefore(tr, pos);
  const mapped = tr.mapping.map(pos);
  const $fig = tr.doc.resolve(mapped);
  const prev = $fig.nodeBefore;
  if (!prev || prev.type.name !== "paragraph") return false;
  const prevPos = mapped - prev.nodeSize;
  tr = tr.setSelection(TextSelection.create(tr.doc, prevPos + prev.nodeSize - 1));
  dispatch?.(tr.scrollIntoView());
  return true;
}

export function needsTrailingWritable(doc: ProseNode): boolean {
  const last = doc.lastChild;
  return last?.type.name === "figure" || last?.type.name === "pageBreak";
}
