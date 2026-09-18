import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, type Transaction } from "@tiptap/pm/state";
import { isMathBlockLanguage } from "@mdword/shared";
import { createMathBlockView } from "./mathBlockView";

export const DEFAULT_MATH_LATEX = String.raw`\int_0^1 x\,dx`;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (latex?: string) => ReturnType;
      updateMathBlock: (latex: string) => ReturnType;
    };
  }
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  defining: true,
  selectable: true,
  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-latex") ?? el.querySelector("pre")?.textContent ?? "",
        renderHTML: () => ({})
      },
      label: { default: null },
      enumerated: { default: true },
      number: { default: null }
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.md-math",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            latex: el.getAttribute("data-latex") ?? el.querySelector("pre")?.textContent ?? "",
            label: el.getAttribute("data-label"),
            enumerated: el.getAttribute("data-enumerated") !== "false"
          };
        }
      },
      { tag: "div[data-math-block]" }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(
        {
          class: "md-math",
          "data-testid": "doc-math-block",
          "data-latex": HTMLAttributes.latex,
          "data-label": HTMLAttributes.label ?? undefined,
          "data-enumerated": HTMLAttributes.enumerated ? "true" : "false"
        },
        HTMLAttributes
      ),
      ["pre", { class: "md-math-fallback" }, String(HTMLAttributes.latex ?? "")]
    ];
  },
  addNodeView() {
    return createMathBlockView;
  },
  addCommands() {
    return {
      setMathBlock:
        (latex = DEFAULT_MATH_LATEX) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { latex, enumerated: true }
          }),
      updateMathBlock:
        (latex: string) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { latex })
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const mathType = state.schema.nodes.mathBlock;
          if (!mathType) return null;
          const replacements: { pos: number; size: number; latex: string }[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "codeBlock" && isMathBlockLanguage(node.attrs.language)) {
              replacements.push({ pos, size: node.nodeSize, latex: node.textContent });
            }
          });
          if (!replacements.length) return null;
          let tr: Transaction | null = null;
          for (const item of replacements.reverse()) {
            tr = (tr ?? state.tr).replaceWith(
              item.pos,
              item.pos + item.size,
              mathType.create({ latex: item.latex, enumerated: true })
            );
          }
          return tr;
        }
      })
    ];
  }
});
