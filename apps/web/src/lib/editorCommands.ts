import type { Editor } from "@tiptap/react";

export function applyBlockStyle(editor: Editor, value: string): void {
  if (value === "p") editor.chain().focus().setParagraph().run();
  else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 }).run();
}

export function currentBlockStyle(editor: Editor | null): string {
  if (!editor) return "p";
  for (const level of [1, 2, 3, 4] as const) {
    if (editor.isActive("heading", { level })) return String(level);
  }
  return "p";
}

export function promptLink(editor: Editor): void {
  const href = window.prompt("URL");
  if (href) editor.chain().focus().setLink({ href }).run();
}

export function promptImage(editor: Editor): void {
  const src = window.prompt("Image path or URL");
  if (src) editor.chain().focus().setImage({ src }).run();
}

export function promptWikilink(editor: Editor): void {
  const target = window.prompt("Wikilink target");
  if (target) {
    editor.chain().focus().insertContent({
      type: "wikiLink",
      attrs: { target, label: target }
    }).run();
  }
}

export function insertTable(editor: Editor): void {
  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

export function insertCallout(editor: Editor): void {
  editor.chain().focus().insertContent({
    type: "callout",
    attrs: { kind: "note" },
    content: [{ type: "paragraph" }]
  }).run();
}

export function insertPageBreak(editor: Editor): void {
  editor.chain().focus().insertContent({ type: "pageBreak" }).run();
}
