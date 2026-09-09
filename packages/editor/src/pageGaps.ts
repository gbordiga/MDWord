import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isFigureInteracting, onFigureIdle } from "./figureInteraction";

export type PageGapsStorage = {
  enabled: boolean;
  usableHeight: number;
  spacerHeight: number;
  contentTop: number;
};

export const pageGapsKey = new PluginKey<DecorationSet>("pageGaps");

export type PageGapBlock = { pos: number; height: number };

/** Place a gap before a block that would start in the bottom margin of the current page. */
export function collectPageGapPositions(
  blocks: PageGapBlock[],
  extra: number,
  usable: number
): number[] {
  if (usable < 48) return [];
  const gaps: number[] = [];
  let y = Math.max(0, extra);
  for (const block of blocks) {
    if (block.height <= 0) continue;
    const used = y % usable;
    if (used > 1 && used + block.height > usable) {
      gaps.push(block.pos);
      y += usable - used;
    }
    y += block.height;
  }
  return gaps;
}

/** A widget <div> inside a <table> foster-parents and splits the table in two. */
export function snapPageGapPos(doc: PMNode, pos: number): number {
  const safe = Math.min(Math.max(0, pos), doc.content.size);
  const $pos = doc.resolve(safe);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "table") return $pos.after(depth);
  }
  return safe;
}

function signature(set: DecorationSet, doc: { nodeSize: number }, spacer: number): string {
  return set.find().map((d) => d.from).join(",") + `@${doc.nodeSize}@${Math.round(spacer)}`;
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
            if (isFigureInteracting()) return;
            const cfg = editor.storage.pageGaps as PageGapsStorage | undefined;
            const current = pageGapsKey.getState(view.state) ?? DecorationSet.empty;
            if (!cfg?.enabled || cfg.usableHeight < 48 || !view.dom.isConnected) {
              if (current.find().length) {
                last = "";
                view.dispatch(view.state.tr.setMeta(pageGapsKey, DecorationSet.empty).setMeta("addToHistory", false));
              }
              return;
            }

            let extra = 0;
            let positions: number[] = [];
            try {
              extra = Math.max(0, cfg.contentTop);
              const blocks: PageGapBlock[] = [];
              view.state.doc.forEach((_node, pos) => {
                const dom = view.nodeDOM(pos);
                if (!(dom instanceof HTMLElement) || dom.classList.contains("md-page-gap")) return;
                blocks.push({ pos, height: dom.offsetHeight });
              });
              positions = collectPageGapPositions(blocks, extra, cfg.usableHeight);
            } catch (error) {
              console.error("page gaps could not measure blocks", error);
              return;
            }
            if (!positions.length) {
              if (current.find().length) {
                last = "";
                view.dispatch(view.state.tr.setMeta(pageGapsKey, DecorationSet.empty).setMeta("addToHistory", false));
              }
              return;
            }

            const widgets = positions.map((pos, index) =>
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
                { side: -1, ignoreSelection: true, key: `page-gap-${index}-${pos}-${Math.round(cfg.spacerHeight)}` }
              )
            );

            const next = DecorationSet.create(view.state.doc, widgets);
            const sig = signature(next, view.state.doc, cfg.spacerHeight);
            if (sig === last || sig === signature(current, view.state.doc, cfg.spacerHeight)) return;
            last = sig;
            view.dispatch(view.state.tr.setMeta(pageGapsKey, next).setMeta("addToHistory", false));
          };

          const schedule = () => {
            if (isFigureInteracting()) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(refresh);
          };

          const ro = new ResizeObserver(schedule);
          ro.observe(view.dom);
          const stopIdle = onFigureIdle(schedule);
          schedule();

          let lastCfg = "";
          return {
            update(_view, prev) {
              const cfg = editor.storage.pageGaps as PageGapsStorage | undefined;
              const sig = `${cfg?.enabled}:${cfg?.usableHeight}:${cfg?.spacerHeight}:${cfg?.contentTop}`;
              if (view.state.doc !== prev.doc || sig !== lastCfg) {
                lastCfg = sig;
                schedule();
              }
            },
            destroy() {
              cancelAnimationFrame(raf);
              ro.disconnect();
              stopIdle();
            }
          };
        }
      })
    ];
  }
});
