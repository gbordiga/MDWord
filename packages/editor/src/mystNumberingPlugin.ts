import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  buildNumberingIndex,
  formatReferenceDisplay,
  resolveCrossReference,
  type GenericNode
} from "@mdword/shared";
import { tiptapToAst } from "./tiptapToAst";
import type { TiptapNode } from "./astToTiptap";

export const mystNumberingKey = new PluginKey("mystNumbering");

function docToAst(doc: { toJSON(): TiptapNode }): GenericNode {
  return tiptapToAst(doc.toJSON() as TiptapNode);
}

export const MystNumbering = Extension.create({
  name: "mystNumbering",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mystNumberingKey,
        props: {
          decorations(state) {
            const index = buildNumberingIndex(docToAst(state.doc));
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "crossRefChip") {
                const label = String(node.attrs.label ?? "");
                const kind = String(node.attrs.kind ?? "ref");
                const target = resolveCrossReference(label, index);
                const display = formatReferenceDisplay(target, kind);
                if (display !== node.attrs.display) {
                  decos.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      "data-display": display,
                      class: "md-cross-ref-chip md-cross-ref-resolved"
                    })
                  );
                }
              }
              if (node.type.name === "mathBlock" && node.attrs.enumerated) {
                const label = String(node.attrs.label ?? "");
                const target = label ? resolveCrossReference(label, index) : undefined;
                const num = target?.number;
                if (num) {
                  decos.push(
                    Decoration.widget(pos + 1, () => {
                      const span = document.createElement("span");
                      span.className = "md-equation-number";
                      span.textContent = `(${num})`;
                      return span;
                    })
                  );
                }
              }
            });
            return decos.length ? DecorationSet.create(state.doc, decos) : null;
          }
        }
      })
    ];
  }
});
