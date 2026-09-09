import type { EditorState } from "@tiptap/pm/state";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { figurePosFromState } from "./figurePos";

export function captionAttr(value: unknown): string {
  return String(value ?? "").trim();
}

export function figureNodeFromState(state: EditorState): ProseNode | null {
  const pos = figurePosFromState(state);
  if (pos == null) return null;
  const node = state.doc.nodeAt(pos);
  return node?.type.name === "figure" ? node : null;
}

export function figureCaptionText(state: EditorState): string {
  const figure = figureNodeFromState(state);
  if (!figure) return "";
  const fromAttr = captionAttr(figure.attrs.caption);
  if (fromAttr) return fromAttr;
  const cap = figure.firstChild;
  return cap?.type.name === "caption" ? cap.textContent : "";
}
