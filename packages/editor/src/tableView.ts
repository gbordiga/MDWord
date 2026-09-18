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
    this.dom.appendChild(this.captionEl);
    this.tableView = new TableView(node, cellMinWidth);
    this.dom.appendChild(this.tableView.dom);
    this.renderCaption(node);
  }

  renderCaption(node: PMNode) {
    const caption = String(node.attrs.caption ?? "").trim();
    this.captionEl.textContent = caption;
    this.captionEl.hidden = !caption;
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.tableView.update(node)) return false;
    this.renderCaption(node);
    return true;
  }

  ignoreMutation(record: ViewMutationRecord) {
    return this.tableView.ignoreMutation(record);
  }

  get contentDOM() {
    return this.tableView.contentDOM;
  }
}
