import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type PageGapsStorage = {
  enabled: boolean;
  usableHeight: number;
  spacerHeight: number;
  contentTop: number;
};

export const pageGapsKey = new PluginKey<DecorationSet>("pageGaps");

/** A widget <div> inside a <table> foster-parents and splits the table in two. */
export function snapPageGapPos(doc: PMNode, pos: number): number {
  const safe = Math.min(Math.max(0, pos), doc.content.size);
  const $pos = doc.resolve(safe);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "table") return $pos.after(depth);
  }
  return safe;
}

function signature(set: DecorationSet, doc: { nodeSize: number }): string {
  return set.find().map((d) => d.from).join(",") + `@${doc.nodeSize}`;
}

export const PageGaps = Extension.create({
  name: "pageGaps",

  addStorage() {
    return {
      enabled: false,
      usableHeight: 800,
      spacerHeight: 80,
      contentTop: 0
    } satisfies PageGapsStorage;
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: pageGapsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(pageGapsKey) as DecorationSet | undefined;
            if (next) return next;
            if (tr.docChanged) return set.map(tr.mapping, tr.doc);
            return set;
          }
        },
        props: {
          decorations(state) {
            return pageGapsKey.getState(state);
          }
        },
        view(view) {
          let raf = 0;
          let last = "";

          const refresh = () => {
            const cfg = editor.storage.pageGaps as PageGapsStorage;
            const current = pageGapsKey.getState(view.state) ?? DecorationSet.empty;
            if (!cfg.enabled || cfg.usableHeight < 48) {
              if (current.find().length) {
                last = "";
                view.dispatch(view.state.tr.setMeta(pageGapsKey, DecorationSet.empty).setMeta("addToHistory", false));
              }
              return;
            }

            const spacers = view.dom.querySelectorAll<HTMLElement>(".md-page-gap");
            let spacerTotal = 0;
            for (const node of spacers) spacerTotal += node.offsetHeight;

            const contentH = Math.max(0, view.dom.scrollHeight - spacerTotal);
            const extra = Math.max(0, cfg.contentTop);
            const flowH = contentH + extra;
            const pages = Math.max(1, Math.ceil(flowH / cfg.usableHeight));
            if (pages < 2) {
              if (current.find().length) {
                last = "";
                view.dispatch(view.state.tr.setMeta(pageGapsKey, DecorationSet.empty).setMeta("addToHistory", false));
              }
              return;
            }

            const prose = view.dom.getBoundingClientRect();
            const midX = prose.left + Math.min(prose.width, 24) + 8;
            const used = new Set<number>();
            const widgets: Decoration[] = [];

            for (let i = 1; i < pages; i++) {
              const y = prose.top - extra + i * cfg.usableHeight + (i - 1) * cfg.spacerHeight;
              if (y < prose.top - 2 || y > prose.bottom + cfg.spacerHeight) continue;
              const hit = view.posAtCoords({ left: midX, top: y - 1 });
              if (!hit) continue;
              const pos = snapPageGapPos(view.state.doc, hit.pos);
              if (used.has(pos)) continue;
              used.add(pos);
              widgets.push(
                Decoration.widget(
                  pos,
                  () => {
                    const el = document.createElement("div");
                    el.className = "md-page-gap";
                    el.style.height = `${cfg.spacerHeight}px`;
                    el.contentEditable = "false";
                    el.setAttribute("data-testid", "page-gap");
                    return el;
                  },
                  { side: -1, ignoreSelection: true, key: `page-gap-${i}-${pos}` }
                )
              );
            }

            const next = DecorationSet.create(view.state.doc, widgets);
            const sig = signature(next, view.state.doc);
            if (sig === last || sig === signature(current, view.state.doc)) return;
            last = sig;
            view.dispatch(view.state.tr.setMeta(pageGapsKey, next).setMeta("addToHistory", false));
          };

          const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(refresh);
          };

          const ro = new ResizeObserver(schedule);
          ro.observe(view.dom);
          schedule();

          return {
            update() {
              schedule();
            },
            destroy() {
              cancelAnimationFrame(raf);
              ro.disconnect();
            }
          };
        }
      })
    ];
  }
});
