import StarterKit from "@tiptap/starter-kit";
import { Code } from "@tiptap/extension-code";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extensions";
import { MdTable, MdTableRow, MdTableCell, MdTableHeader } from "./tableExt";
import {
  Subscript,
  Superscript,
  InlineMath,
  CiteChip,
  CrossRefChip,
  FootnoteRef,
  Abbreviation
} from "./mystInline";
import { MathBlock } from "./mathBlock";
import { MystNumbering } from "./mystNumberingPlugin";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Underline } from "@tiptap/extension-underline";
import { WikiLink, Callout, PageBreak, MystRaw } from "./extensions";
import { Mermaid } from "./mermaid";
import { Figure } from "./figure";
import { PageGaps } from "./pageGaps";
import { SearchHighlight } from "./searchHighlight";

export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      bulletList: { HTMLAttributes: { class: "md-list md-list-bullet" } },
      orderedList: { HTMLAttributes: { class: "md-list md-list-ordered" } },
      listItem: { HTMLAttributes: { class: "md-list-item" } },
      blockquote: { HTMLAttributes: { class: "md-quote" } },
      code: false,
      link: false,
      underline: false,
      codeBlock: { HTMLAttributes: { class: "md-code" } },
      horizontalRule: { HTMLAttributes: { class: "md-hr" } }
    }),
    Underline,
    Code.extend({ excludes: "" }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { class: "md-link", title: "Ctrl+click to open" }
    }),
    Placeholder.configure({ placeholder: "Start writing…" }),
    MdTable,
    MdTableRow,
    MdTableHeader,
    MdTableCell,
    Subscript,
    Superscript,
    InlineMath,
    CiteChip,
    CrossRefChip,
    FootnoteRef,
    Abbreviation,
    MathBlock,
    MystNumbering,
    TaskList,
    TaskItem.configure({ nested: true }),
    WikiLink,
    Callout,
    PageBreak,
    Figure,
    MystRaw,
    Mermaid,
    PageGaps,
    SearchHighlight
  ];
}

export { WikiLink, Callout, PageBreak, Figure, MystRaw, Mermaid };
export type { FigureAttrs, ImageLayout } from "./imageModel";
export {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  IMAGE_LAYOUTS,
  widthForLayoutChange
} from "./imageModel";
