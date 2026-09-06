import type { Editor } from "@tiptap/react";
import { collectSearchMatches, nextMatchIndex, normalizeHref } from "@mdword/editor";

export function applyBlockStyle(editor: Editor, value: string): void {
  if (value === "p") editor.chain().focus().setParagraph().run();
  else editor.chain().focus().setHeading({ level: Number(value) as 1 | 2 | 3 | 4 }).run();
}

export function currentBlockStyle(editor: Editor | null): string {
  if (!editor) return "p";
  for (const level of [1, 2, 3, 4] as const) {
    if (editor.isActive("heading", { level })) return String(level);
  }
  return "p";
}

export function selectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, " ");
}

export function applyLink(editor: Editor, href: string, text?: string): boolean {
  const url = normalizeHref(href);
  if (!url) return false;
  const { empty } = editor.state.selection;
  const inLink = editor.isActive("link");
  if (empty && !inLink) {
    const label = (text ?? "").trim();
    if (!label) return false;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: label,
        marks: [{ type: "link", attrs: { href: url } }]
      })
      .run();
    return true;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  return true;
}

export function removeLink(editor: Editor): void {
  editor.chain().focus().extendMarkRange("link").unsetLink().run();
}

export function insertImage(editor: Editor, src: string, alt?: string): boolean {
  const url = src.trim();
  if (!url) return false;
  editor.chain().focus().setImage({ src: url, alt: (alt ?? "").trim() }).run();
  return true;
}

export function insertWikilink(editor: Editor, target: string, label?: string): boolean {
  const dest = target.trim();
  if (!dest) return false;
  editor
    .chain()
    .focus()
    .insertContent({
      type: "wikiLink",
      attrs: { target: dest, label: (label ?? dest).trim() || dest }
    })
    .run();
  return true;
}

export function insertTable(editor: Editor): void {
  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

export function insertCallout(editor: Editor, kind = "note"): void {
  editor.chain().focus().insertContent({
    type: "callout",
    attrs: { kind },
    content: [{ type: "paragraph" }]
  }).run();
}

export function setCalloutKind(editor: Editor, kind: string): void {
  editor.chain().focus().updateAttributes("callout", { kind }).run();
}

export function insertPageBreak(editor: Editor): void {
  editor.chain().focus().insertContent({ type: "pageBreak" }).run();
}

function textChunks(editor: Editor): { pos: number; text: string }[] {
  const chunks: { pos: number; text: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text) chunks.push({ pos, text: node.text });
  });
  return chunks;
}

export function findInDocument(
  editor: Editor,
  query: string,
  direction: 1 | -1,
  options?: { focus?: boolean; from?: "caret-end" | "caret-start" }
): { count: number; index: number } {
  const matches = collectSearchMatches(textChunks(editor), query);
  if (!matches.length) return { count: 0, index: -1 };
  const from =
    direction === 1
      ? options?.from === "caret-start"
        ? editor.state.selection.from
        : editor.state.selection.to
      : editor.state.selection.from;
  const index = nextMatchIndex(matches, from, direction);
  const match = matches[index];
  if (match) {
    const chain = options?.focus === false ? editor.chain() : editor.chain().focus();
    chain.setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
  }
  return { count: matches.length, index };
}

export function focusHeading(editor: Editor, index: number): void {
  let i = 0;
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      if (i === index) {
        found = pos;
        return false;
      }
      i += 1;
    }
  });
  if (found == null) return;
  editor.chain().focus().setTextSelection(found + 1).scrollIntoView().run();
  const el = editor.view.nodeDOM(found);
  if (el instanceof HTMLElement) el.scrollIntoView({ block: "start", behavior: "smooth" });
}
