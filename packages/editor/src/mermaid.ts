import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, type Transaction } from "@tiptap/pm/state";
import { isMermaidLanguage } from "@mdword/shared";
import { createMermaidView } from "./mermaidView";

export const DEFAULT_MERMAID_SOURCE = "flowchart TB\n  A[Start] --> B[End]";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (source?: string) => ReturnType;
      updateMermaid: (source: string) => ReturnType;
    };
  }
}

export const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  defining: true,
  selectable: true,
  addAttributes() {
    return {
      source: {
        default: "",
        parseHTML: (el) => el.querySelector("pre")?.textContent ?? el.getAttribute("data-source") ?? "",
        renderHTML: () => ({})
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.md-mermaid",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return { source: el.querySelector("pre")?.textContent ?? el.getAttribute("data-source") ?? "" };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes({ class: "md-mermaid", "data-testid": "doc-mermaid" }, HTMLAttributes),
      ["pre", { class: "mermaid" }, String(HTMLAttributes.source ?? "")]
    ];
  },
  addNodeView() {
    return createMermaidView;
  },
  addCommands() {
    return {
      setMermaid:
        (source = DEFAULT_MERMAID_SOURCE) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { source } }),
      updateMermaid:
        (source: string) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { source })
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const mermaidType = state.schema.nodes.mermaid;
          if (!mermaidType) return null;
          const replacements: { pos: number; size: number; source: string }[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "codeBlock" && isMermaidLanguage(node.attrs.language)) {
              replacements.push({ pos, size: node.nodeSize, source: node.textContent });
            }
          });
          if (!replacements.length) return null;
          let tr: Transaction | null = null;
          for (const item of replacements.reverse()) {
            tr = (tr ?? state.tr).replaceWith(item.pos, item.pos + item.size, mermaidType.create({ source: item.source }));
          }
          return tr;
        }
      })
    ];
  }
});
