import type { EditorState } from "@tiptap/pm/state";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { figurePosFromState } from "./figurePos";

export function captionAttr(value: unknown): string {
  return String(value ?? "").trim();
}

/** One user-facing string: caption is the alternative text. */
export function figureText(alt?: unknown, caption?: unknown): string {
  return captionAttr(caption) || captionAttr(alt);
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
  const fromAttrs = figureText(figure.attrs.alt, figure.attrs.caption);
  if (fromAttrs) return fromAttrs;
  const cap = figure.firstChild;
  return cap?.type.name === "caption" ? cap.textContent : "";
}
