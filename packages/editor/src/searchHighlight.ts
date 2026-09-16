import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { SearchMatch } from "./search";

export const searchHighlightKey = new PluginKey<DecorationSet>("searchHighlight");

export type SearchHighlightMeta = {
  matches: SearchMatch[];
  current: number;
};

export function searchHighlightDecorations(
  doc: PMNode,
  matches: SearchMatch[],
  current: number
): DecorationSet {
  const max = doc.content.size;
  const decos: Decoration[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match || match.from < 0 || match.to > max || match.from >= match.to) continue;
    decos.push(
      Decoration.inline(match.from, match.to, {
        class: i === current ? "md-find-match md-find-match-current" : "md-find-match",
        "data-testid": "find-match",
        ...(i === current ? { "data-current": "true" } : {})
      })
    );
  }
  return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchHighlight: (matches: SearchMatch[], current: number) => ReturnType;
      clearSearchHighlight: () => ReturnType;
    };
  }
}

export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addCommands() {
    return {
      setSearchHighlight:
        (matches, current) =>
        ({ tr }) => {
          tr.setMeta(searchHighlightKey, { matches, current } satisfies SearchHighlightMeta).setMeta(
            "addToHistory",
            false
          );
          return true;
        },
      clearSearchHighlight:
        () =>
        ({ tr }) => {
          tr.setMeta(searchHighlightKey, { matches: [], current: -1 } satisfies SearchHighlightMeta).setMeta(
            "addToHistory",
            false
          );
          return true;
        }
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(searchHighlightKey) as SearchHighlightMeta | undefined;
            if (next) return searchHighlightDecorations(tr.doc, next.matches, next.current);
            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      })
    ];
  }
});
