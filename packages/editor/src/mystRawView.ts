import type { Node as ProseNode } from "@tiptap/pm/model";
import type { EditorView, NodeView } from "@tiptap/pm/view";

export class MystRawView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;

  constructor(node: ProseNode, _view: EditorView, _getPos: () => number | undefined) {
    const wrap = document.createElement("div");
    wrap.className = "md-myst-raw-card";
    wrap.dataset.testid = "myst-raw-card";

    const head = document.createElement("div");
    head.className = "md-myst-raw-head";
    head.textContent = String(node.attrs.name ?? "unknown");

    const body = document.createElement("pre");
    body.className = "md-myst-raw-body";
    body.textContent = String(node.attrs.source ?? "").trim() || `::: {${node.attrs.name}}\n:::`;

    wrap.appendChild(head);
    wrap.appendChild(body);
    this.dom = wrap;
  }

  update(node: ProseNode): boolean {
    if (node.type.name !== "mystRaw") return false;
    this.dom.querySelector(".md-myst-raw-head")!.textContent = String(node.attrs.name ?? "unknown");
    const body = this.dom.querySelector(".md-myst-raw-body") as HTMLElement;
    body.textContent = String(node.attrs.source ?? "").trim() || `::: {${node.attrs.name}}\n:::`;
    return true;
  }
}
