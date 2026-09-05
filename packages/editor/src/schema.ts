import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { WikiLink, Callout, PageBreak, Figure, Caption, MystRaw } from "./extensions";

export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: { HTMLAttributes: { class: "md-code" } }
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
    Image,
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
    Caption,
    MystRaw
  ];
}

export { WikiLink, Callout, PageBreak, Figure, Caption, MystRaw };
