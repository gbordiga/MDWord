"use client";

import type { Editor } from "@tiptap/react";
import type { TocItem } from "@mdword/renderer";

/** A heading in the live editor document, with its ProseMirror position. */
export type OutlineHeading = { pos: number; depth: number; text: string };

const MAX_HEADING_DEPTH = 6;

/**
 * Single traversal shared by the visible outline, the sidebar outline and the
 * jump actions. Keeping one source of truth prevents the list from drifting
 * away from the heading the user actually clicks.
 */
function headingEntries(editor: Editor, maxDepth: number): OutlineHeading[] {
  const entries: OutlineHeading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const depth = Math.min(MAX_HEADING_DEPTH, Math.max(1, Number(node.attrs.level ?? 1)));
    if (depth > maxDepth) return;
    entries.push({ pos, depth, text: node.textContent.trim() });
  });
  return entries;
}

/** Every heading in the editor, including empty ones (listed as “Untitled”). */
export function collectEditorOutline(editor: Editor): OutlineHeading[] {
  return headingEntries(editor, MAX_HEADING_DEPTH);
}

export function collectEditorHeadings(editor: Editor, maxDepth = 3): TocItem[] {
  const items: TocItem[] = [];
  const counters = [0, 0, 0, 0, 0, 0];
  for (const { depth, text } of headingEntries(editor, maxDepth)) {
    // Empty headings still consume a number so the outline matches the
    // numbered export, but they are not listed.
    for (let i = depth; i < counters.length; i++) counters[i] = 0;
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    if (!text) continue;
    items.push({ depth, text, number: counters.slice(0, depth).join(".") });
  }
  return items;
}

export function jumpToHeadingPos(editor: Editor, pos: number): void {
  editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  const el = editor.view.nodeDOM(pos);
  if (typeof HTMLElement !== "undefined" && el instanceof HTMLElement) {
    el.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

export function jumpToHeading(editor: Editor, index: number, maxDepth = 3): void {
  const target = headingEntries(editor, maxDepth).filter((heading) => heading.text)[index];
  if (!target) return;
  jumpToHeadingPos(editor, target.pos);
}
