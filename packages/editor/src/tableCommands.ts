import { findParentNode } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type {} from "@tiptap/extension-table";
import type { Node as PMNode } from "@tiptap/pm/model";

export function findTableSelection(state: Editor["state"]) {
  return findParentNode((node) => node.type.name === "table")(state.selection);
}

function tableDomWidth(editor: Editor, tablePos: number): number {
  const dom = editor.view.nodeDOM(tablePos) as HTMLElement | null;
  const tableEl = dom?.nodeName === "TABLE" ? dom : dom?.querySelector("table");
  const width = tableEl?.getBoundingClientRect().width;
  return width && width > 0 ? width : 600;
}

function forEachTableCell(
  table: PMNode,
  tablePos: number,
  fn: (cellPos: number, cell: PMNode, rowIndex: number, colIndex: number) => void
): void {
  let rowPos = tablePos + 1;
  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex++) {
    const row = table.child(rowIndex);
    let cellPos = rowPos + 1;
    for (let colIndex = 0; colIndex < row.childCount; colIndex++) {
      const cell = row.child(colIndex);
      fn(cellPos, cell, rowIndex, colIndex);
      cellPos += cell.nodeSize;
    }
    rowPos += row.nodeSize;
  }
}

export function colwidthsFromFirstRow(tableNode: PMNode): number[] | null {
  const firstRow = tableNode.child(0);
  if (!firstRow) return null;
  const widths: number[] = [];
  for (let i = 0; i < firstRow.childCount; i++) {
    const cell = firstRow.child(i);
    const colwidth = cell.attrs.colwidth as number[] | null | undefined;
    if (!Array.isArray(colwidth) || !colwidth[0]) return null;
    widths.push(colwidth[0]);
  }
  return widths.length ? widths : null;
}

export function ratiosFromColwidths(colwidths: number[]): number[] {
  const sum = colwidths.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return colwidths.map(() => 1);
  return colwidths.map((value) => value / sum);
}

export function colwidthsFromRatios(ratios: number[], totalWidth: number, minWidth = 40): number[] {
  const sum = ratios.reduce((acc, value) => acc + value, 0) || ratios.length || 1;
  return ratios.map((ratio) => Math.max(minWidth, Math.round((ratio / sum) * totalWidth)));
}

function tableSourceKindAfterCaptionChange(
  attrs: Record<string, unknown>,
  nextCaption: string | null
): string {
  if (nextCaption) return attrs.sourceKind === "list-table" ? "list-table" : "table";
  if (attrs.widths || attrs.label || attrs.align || attrs.tableWidth) {
    return String(attrs.sourceKind ?? "table");
  }
  return "gfm";
}

export function setTableCaption(editor: Editor, caption: string | null): boolean {
  const found = findTableSelection(editor.state);
  if (!found) return false;
  const nextCaption = caption?.trim() ? caption.trim() : null;
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      caption: nextCaption,
      sourceKind: tableSourceKindAfterCaptionChange(found.node.attrs, nextCaption)
    })
  );
  return true;
}

export function setTableCellAlign(editor: Editor, align: "left" | "center" | "right"): boolean {
  return editor.chain().focus().setCellAttribute("align", align).run();
}

export function setTableAlign(editor: Editor, align: "left" | "center" | "right"): boolean {
  const found = findTableSelection(editor.state);
  if (!found) return false;
  return editor
    .chain()
    .focus()
    .updateAttributes("table", {
      align,
      sourceKind: found.node.attrs.sourceKind === "list-table" ? "list-table" : "table"
    })
    .run();
}

export function setTableWidthsAuto(editor: Editor): boolean {
  const found = findTableSelection(editor.state);
  if (!found) return false;
  let tr = editor.state.tr;
  forEachTableCell(found.node, found.pos, (cellPos, cell) => {
    if (cell.attrs.colwidth) {
      tr = tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: null });
    }
  });
  tr = tr.setNodeMarkup(found.pos, undefined, {
    ...found.node.attrs,
    widths: null,
    sourceKind: "gfm"
  });
  editor.view.dispatch(tr);
  return true;
}

export function setTableWidthsEqual(editor: Editor): boolean {
  const found = findTableSelection(editor.state);
  if (!found) return false;
  const colCount = Math.max(found.node.child(0)?.childCount ?? 1, 1);
  const totalWidth = tableDomWidth(editor, found.pos);
  const colWidth = Math.max(40, Math.floor(totalWidth / colCount));
  const ratios = Array.from({ length: colCount }, () => 1);
  let tr = editor.state.tr;
  forEachTableCell(found.node, found.pos, (cellPos, cell, rowIndex, colIndex) => {
    if (rowIndex === 0) {
      tr = tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: [colWidth] });
    } else if (cell.attrs.colwidth) {
      tr = tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: null });
    }
    void colIndex;
  });
  tr = tr.setNodeMarkup(found.pos, undefined, {
    ...found.node.attrs,
    widths: JSON.stringify(ratios),
    sourceKind: "table"
  });
  editor.view.dispatch(tr);
  return true;
}

export function syncTableWidthsFromColwidth(editor: Editor): boolean {
  const found = findTableSelection(editor.state);
  if (!found) return false;
  const colwidths = colwidthsFromFirstRow(found.node);
  if (!colwidths) return false;
  const ratios = ratiosFromColwidths(colwidths);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      widths: JSON.stringify(ratios),
      sourceKind: "table"
    })
  );
  return true;
}
