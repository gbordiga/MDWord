import type { Editor } from "@tiptap/core";
import { canonicalImageSrc } from "./imageDisplay";
import { isExternalImageUrl } from "@mdword/shared";

export function collectEditorExternalFigures(editor: Editor): { pos: number; src: string }[] {
  const out: { pos: number; src: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "figure") return;
    const src = canonicalImageSrc(String(node.attrs.src ?? ""));
    if (isExternalImageUrl(src)) out.push({ pos, src });
  });
  return out;
}

export function applyFigureSources(editor: Editor, updates: { pos: number; src: string }[]): boolean {
  if (!updates.length) return false;
  let tr = editor.state.tr;
  let changed = false;
  for (const { pos, src } of [...updates].sort((a, b) => b.pos - a.pos)) {
    const node = tr.doc.nodeAt(pos);
    if (!node || node.type.name !== "figure") continue;
    const next = canonicalImageSrc(src);
    if (String(node.attrs.src ?? "") === next) continue;
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: next });
    changed = true;
  }
  if (!changed) return false;
  editor.view.dispatch(tr);
  return true;
}
