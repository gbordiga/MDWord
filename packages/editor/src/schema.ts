import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { WikiLink, Callout, PageBreak, MystRaw } from "./extensions";
import { Figure } from "./figure";
import { PageGaps } from "./pageGaps";

export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      bulletList: { HTMLAttributes: { class: "md-list md-list-bullet" } },
      orderedList: { HTMLAttributes: { class: "md-list md-list-ordered" } },
      listItem: { HTMLAttributes: { class: "md-list-item" } },
      blockquote: { HTMLAttributes: { class: "md-quote" } },
      codeBlock: { HTMLAttributes: { class: "md-code" } },
      horizontalRule: { HTMLAttributes: { class: "md-hr" } }
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { class: "md-link", title: "Ctrl+click to open" }
    }),
    Placeholder.configure({ placeholder: "Start writing…" }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    WikiLink,
    Callout,
    PageBreak,
    Figure,
    MystRaw,
    PageGaps
  ];
}

export { WikiLink, Callout, PageBreak, Figure, MystRaw };
export type { FigureAttrs, ImageLayout } from "./imageModel";
export {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  IMAGE_LAYOUTS,
  widthForLayoutChange
} from "./imageModel";
