import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Plugin } from "@tiptap/pm/state";
import { MdTableView } from "./tableView";
import { ratiosFromColwidths } from "./tableCommands";
import { scaledColumnResizeFix } from "./scaledColumnResizeFix";
import { tableSelectionFix } from "./tableSelectionFix";

const alignAttr = {
  default: null as string | null,
  parseHTML: (el: HTMLElement) => el.getAttribute("data-align"),
  renderHTML: (attrs: { align?: string | null }) =>
    attrs.align ? { "data-align": attrs.align, style: `text-align:${attrs.align}` } : {}
};

export const MdTable = Table.extend({
  addAttributes() {
    return {
      align: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-align") || el.closest(".md-table-figure")?.getAttribute("data-align"),
        renderHTML: (attrs: { align?: string | null }) =>
          attrs.align ? { "data-align": attrs.align } : {}
      },
      widths: { default: null },
      tableWidth: { default: null },
      caption: { default: null },
      label: { default: null },
      headerRows: { default: 1 },
      sourceKind: { default: "gfm" }
    };
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "table",
      {
        ...HTMLAttributes,
        class: "md-table",
        "data-source-kind": HTMLAttributes.sourceKind ?? "gfm",
        "data-label": HTMLAttributes.label ?? undefined
      },
      0
    ];
  },
  addNodeView() {
    const cellMinWidth = this.options.cellMinWidth;
    return ({ node }) => new MdTableView(node, cellMinWidth);
  },
  addProseMirrorPlugins() {
    const isResizable = this.options.resizable && this.editor.isEditable;
    const parent = this.parent?.() ?? [];
    return [
      tableSelectionFix({ handleWidth: this.options.handleWidth }),
      ...(isResizable
        ? [
            scaledColumnResizeFix({
              cellMinWidth: this.options.cellMinWidth,
              defaultCellMinWidth: this.options.cellMinWidth
            })
          ]
        : []),
      ...parent,
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const editor = this.editor;
          if (!editor?.isEditable) return null;
          let tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "table") return;
            const oldNode = oldState.doc.nodeAt(pos);
            if (!oldNode || oldNode.type.name !== "table") return;
            if (tableColwidthSignature(oldNode) === tableColwidthSignature(node)) return;
            const colwidths = colwidthsFromNode(node);
            if (!colwidths) return;
            tr = tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              widths: JSON.stringify(ratiosFromColwidths(colwidths)),
              sourceKind: node.attrs.sourceKind === "list-table" ? "list-table" : "table"
            });
            changed = true;
          });
          return changed ? tr : null;
        }
      })
    ];
  }
}).configure({
  resizable: true,
  cellMinWidth: 40,
  handleWidth: 5,
  lastColumnResizable: true
});

function colwidthsFromNode(table: import("@tiptap/pm/model").Node): number[] | null {
  const firstRow = table.child(0);
  if (!firstRow) return null;
  const widths: number[] = [];
  for (let index = 0; index < firstRow.childCount; index++) {
    const cell = firstRow.child(index);
    const colwidth = cell.attrs.colwidth as number[] | null | undefined;
    if (!Array.isArray(colwidth) || !colwidth[0]) return null;
    widths.push(colwidth[0]);
  }
  return widths.length ? widths : null;
}

function tableColwidthSignature(table: import("@tiptap/pm/model").Node): string {
  return colwidthsFromNode(table)?.join(",") ?? "";
}

export const MdTableRow = TableRow;

export const MdTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: alignAttr
    };
  }
});

export const MdTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: alignAttr
    };
  }
});
