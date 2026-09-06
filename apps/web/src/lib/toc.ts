"use client";

import type { Editor } from "@tiptap/react";
import type { TocItem } from "@mdword/renderer";

export function collectEditorHeadings(editor: Editor, maxDepth = 3): TocItem[] {
  const items: TocItem[] = [];
  const counters = [0, 0, 0, 0, 0, 0];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "heading") return;
    const depth = Math.min(6, Math.max(1, Number(node.attrs.level ?? 1)));
    if (depth > maxDepth) return;
    for (let i = depth; i < counters.length; i++) counters[i] = 0;
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    const text = node.textContent.trim();
    if (!text) return;
    items.push({ depth, text, number: counters.slice(0, depth).join(".") });
  });
  return items;
}

export function jumpToHeading(editor: Editor, index: number, maxDepth = 3): void {
  let i = 0;
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const depth = Math.min(6, Math.max(1, Number(node.attrs.level ?? 1)));
    if (depth > maxDepth) return;
    if (i === index) {
      found = pos;
      return false;
    }
    i += 1;
  });
  if (found == null) return;
  editor.chain().focus().setTextSelection(found + 1).scrollIntoView().run();
  const el = editor.view.nodeDOM(found);
  if (el instanceof HTMLElement) el.scrollIntoView({ block: "start", behavior: "smooth" });
}
