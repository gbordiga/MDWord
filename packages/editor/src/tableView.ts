import { TableView } from "@tiptap/extension-table";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView, ViewMutationRecord } from "@tiptap/pm/view";

export class MdTableView implements NodeView {
  node: PMNode;
  dom: HTMLDivElement;
  captionEl: HTMLDivElement;
  tableView: TableView;

  constructor(node: PMNode, cellMinWidth: number) {
    this.node = node;
    this.dom = document.createElement("div");
    this.dom.className = "md-table-figure";
    this.captionEl = document.createElement("div");
    this.captionEl.className = "md-table-caption";
    this.captionEl.dataset.testid = "doc-table-caption";
    this.dom.appendChild(this.captionEl);
    this.tableView = new TableView(node, cellMinWidth);
    this.dom.appendChild(this.tableView.dom);
    this.releaseAutoColumns(node);
    this.renderChrome(node);
  }

  renderChrome(node: PMNode) {
    const caption = String(node.attrs.caption ?? "").trim();
    this.captionEl.textContent = caption;
    this.captionEl.hidden = !caption;
    const align = String(node.attrs.align ?? "");
    this.dom.dataset.testid = "doc-table";
    if (align === "left" || align === "center" || align === "right") {
      this.dom.dataset.align = align;
    } else {
      delete this.dom.dataset.align;
    }
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.tableView.update(node)) return false;
    this.releaseAutoColumns(node);
    this.renderChrome(node);
    return true;
  }

  /** TipTap sets min-width when colwidth is cleared and leaves the old pixel width in place. */
  releaseAutoColumns(node: PMNode) {
    const table = this.tableView.dom.querySelector("table");
    const colgroup = table?.querySelector("colgroup");
    if (!table || !colgroup) return;
    const row = node.firstChild;
    if (!row) return;
    let col = colgroup.firstElementChild as HTMLElement | null;
    let fixed = true;
    for (let i = 0; i < row.childCount && col; i++) {
      const attrs = row.child(i).attrs as { colspan?: number; colwidth?: number[] | null };
      const span = Math.max(1, Number(attrs.colspan ?? 1));
      const widths = Array.isArray(attrs.colwidth) ? attrs.colwidth : null;
      for (let j = 0; j < span && col; j++) {
        const hasWidth = Boolean(widths?.[j]);
        if (!hasWidth) {
          fixed = false;
          col.style.removeProperty("width");
        }
        col = col.nextElementSibling as HTMLElement | null;
      }
    }
    if (!fixed) table.style.removeProperty("width");
  }

  ignoreMutation(record: ViewMutationRecord) {
    return this.tableView.ignoreMutation(record);
  }

  get contentDOM() {
    return this.tableView.contentDOM;
  }
}
