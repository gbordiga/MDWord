import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import {
  clampImageWidth,
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  isImageLayout,
  parseWidthPercent,
  type FigureAttrs,
  type ImageLayout
} from "./imageModel";
import { mediaDropPlugin } from "./mediaDrop";
import { createFigureView } from "./figureView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (attrs: Partial<FigureAttrs> & { src: string }) => ReturnType;
      updateFigure: (attrs: Partial<FigureAttrs>) => ReturnType;
      setFigureCaption: (text: string) => ReturnType;
      ensureFigureCaption: () => ReturnType;
    };
  }
}

function figureClass(layout: ImageLayout, selected: boolean): string {
  return ["md-figure", `md-layout-${layout}`, selected ? "is-selected" : ""].filter(Boolean).join(" ");
}

function figurePosFromSelection(state: EditorState): number | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === "figure") return sel.from;
  for (let depth = sel.$from.depth; depth > 0; depth -= 1) {
    if (sel.$from.node(depth).type.name === "figure") return sel.$from.before(depth);
  }
  return null;
}

export const figureSelectionKey = new PluginKey<number | null>("mdword-figure-sel");

function resolveFigurePos(state: EditorState): number | null {
  return figurePosFromSelection(state) ?? figureSelectionKey.getState(state) ?? null;
}

function posValid(state: EditorState, pos: number | null | undefined): pos is number {
  return pos != null && state.doc.nodeAt(pos)?.type.name === "figure";
}

function firstFigurePos(state: EditorState): number | null {
  const resolved = resolveFigurePos(state);
  if (posValid(state, resolved)) return resolved;
  let found: number | null = null;
  state.doc.descendants((node, pos) => {
    if (node.type.name === "figure") {
      found = pos;
      return false;
    }
  });
  return found;
}

export function figureCaptionText(state: EditorState): string {
  const pos = firstFigurePos(state);
  if (pos == null) return "";
  const figure = state.doc.nodeAt(pos);
  const cap = figure?.firstChild;
  return cap?.type.name === "caption" ? cap.textContent : "";
}

export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "caption?",
  defining: true,
  draggable: false,
  selectable: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      width: {
        default: DEFAULT_IMAGE_WIDTH,
        parseHTML: (el) => parseWidthPercent(el.getAttribute("data-width") || el.getAttribute("width")),
        renderHTML: (attrs) => ({ "data-width": String(attrs.width ?? DEFAULT_IMAGE_WIDTH) })
      },
      layout: {
        default: DEFAULT_IMAGE_LAYOUT,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-layout") || "";
          return isImageLayout(raw) ? raw : DEFAULT_IMAGE_LAYOUT;
        },
        renderHTML: (attrs) => ({ "data-layout": String(attrs.layout ?? DEFAULT_IMAGE_LAYOUT) })
      },
      label: { default: null }
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const img = el.querySelector("img");
          const src = img?.getAttribute("src") || el.getAttribute("data-src") || "";
          if (!src) return false;
          const layout = el.getAttribute("data-layout") || "";
          return {
            src,
            alt: img?.getAttribute("alt") || "",
            width: parseWidthPercent(el.getAttribute("data-width") || img?.getAttribute("width")),
            layout: isImageLayout(layout) ? layout : DEFAULT_IMAGE_LAYOUT,
            label: el.getAttribute("data-label")
          };
        },
        contentElement: "figcaption"
      },
      {
        tag: "img[src]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          if (el.closest("figure")) return false;
          const src = el.getAttribute("src") || "";
          if (!src) return false;
          return {
            src,
            alt: el.getAttribute("alt") || "",
            width: parseWidthPercent(el.getAttribute("width") || el.style.width),
            layout: DEFAULT_IMAGE_LAYOUT,
            label: null
          };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes.src ?? "");
    const alt = String(HTMLAttributes.alt ?? "");
    const width = clampImageWidth(Number(HTMLAttributes.width ?? DEFAULT_IMAGE_WIDTH));
    const layout = isImageLayout(HTMLAttributes.layout) ? HTMLAttributes.layout : DEFAULT_IMAGE_LAYOUT;
    const label = HTMLAttributes.label ? String(HTMLAttributes.label) : "";
    return [
      "figure",
      mergeAttributes({
        class: figureClass(layout, false),
        "data-width": String(width),
        "data-layout": layout,
        "data-label": label || undefined,
        "data-testid": "doc-figure"
      }),
      ["img", { src, alt, "data-testid": "doc-image" }],
      ["figcaption", { class: "md-caption" }, 0]
    ];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => createFigureView({ node, editor, getPos });
  },
  addCommands() {
    return {
      setFigure:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                src: attrs.src,
                alt: attrs.alt ?? "",
                width: clampImageWidth(Number(attrs.width ?? DEFAULT_IMAGE_WIDTH)),
                layout: isImageLayout(attrs.layout) ? attrs.layout : DEFAULT_IMAGE_LAYOUT,
                label: attrs.label ?? null
              }
            })
            .command(({ state, commands }) => {
              let found: number | null = null;
              state.doc.nodesBetween(0, state.selection.from, (node, pos) => {
                if (node.type.name === "figure") found = pos;
              });
              return found != null ? commands.setNodeSelection(found) : true;
            })
            .run(),
      updateFigure:
        (attrs) =>
        ({ state, tr, dispatch }) => {
          const pos = firstFigurePos(state);
          if (pos == null) return false;
          const figure = state.doc.nodeAt(pos);
          if (!figure || figure.type.name !== "figure") return false;
          const next = {
            ...figure.attrs,
            ...attrs,
            width: clampImageWidth(Number(attrs.width ?? figure.attrs.width ?? DEFAULT_IMAGE_WIDTH)),
            layout: isImageLayout(attrs.layout) ? attrs.layout : isImageLayout(figure.attrs.layout) ? figure.attrs.layout : DEFAULT_IMAGE_LAYOUT
          };
          if (
            next.width === figure.attrs.width &&
            next.layout === figure.attrs.layout &&
            next.alt === figure.attrs.alt &&
            next.src === figure.attrs.src &&
            next.label === figure.attrs.label
          ) {
            return true;
          }
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, next);
            dispatch(tr);
          }
          return true;
        },
      setFigureCaption:
        (text) =>
        ({ state, tr, dispatch }) => {
          const pos = firstFigurePos(state);
          if (pos == null) return false;
          const figure = state.doc.nodeAt(pos);
          if (!figure || figure.type.name !== "figure") return false;
          const captionType = state.schema.nodes.caption;
          if (!captionType) return false;
          const trimmed = text.trim();
          const current = figure.firstChild?.type.name === "caption" ? figure.firstChild.textContent : "";
          if (current === trimmed) return true;
          const next = trimmed
            ? captionType.create(null, trimmed ? state.schema.text(trimmed) : undefined)
            : null;
          const from = pos + 1;
          const to = pos + figure.nodeSize - 1;
          if (dispatch) {
            if (next) tr.replaceWith(from, to, next);
            else tr.delete(from, to);
            dispatch(tr);
          }
          return true;
        },
      ensureFigureCaption:
        () =>
        ({ state, tr, dispatch }) => {
          const pos = firstFigurePos(state);
          if (pos == null) return false;
          const figure = state.doc.nodeAt(pos);
          if (!figure || figure.type.name !== "figure") return false;
          if (figure.firstChild?.type.name === "caption") return true;
          const captionType = state.schema.nodes.caption;
          if (!captionType) return false;
          if (dispatch) {
            tr.insert(pos + 1, captionType.create());
            dispatch(tr);
          }
          return true;
        }
    };
  },
  addProseMirrorPlugins() {
    return [
      mediaDropPlugin(),
      new Plugin({
        key: figureSelectionKey,
        state: {
          init: (_config, state) => figurePosFromSelection(state),
          apply(tr, value, _old, state) {
            const pos = figurePosFromSelection(state);
            if (pos != null) return pos;
            if (value == null) return null;
            const mapped = tr.docChanged ? tr.mapping.map(value) : value;
            return state.doc.nodeAt(mapped)?.type.name === "figure" ? mapped : null;
          }
        }
      })
    ];
  }
});

export const Caption = Node.create({
  name: "caption",
  content: "inline*",
  parseHTML() {
    return [{ tag: "figcaption" }, { tag: "span.md-caption-text" }];
  },
  renderHTML() {
    return ["span", { class: "md-caption-text" }, 0];
  }
});
