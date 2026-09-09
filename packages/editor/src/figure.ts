import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection, Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";
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
import { figureSelectionKey } from "./figureKeys";
import { figurePosFromSelection, figurePosFromState } from "./figurePos";
import { captionAttr } from "./figureCaption";
import {
  exitFigureAfter,
  exitFigureBefore,
  insertFigureTransaction,
  needsTrailingWritable
} from "./figureInsert";
import { moveFigureBy } from "./figureMove";
import { handleFigureAreaClick } from "./figureClick";

export { figureSelectionKey } from "./figureKeys";
export { figureCaptionText } from "./figureCaption";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (attrs: Partial<FigureAttrs> & { src: string }) => ReturnType;
      updateFigure: (attrs: Partial<FigureAttrs>) => ReturnType;
      setFigureCaption: (text: string) => ReturnType;
      exitFigureAfter: () => ReturnType;
      exitFigureBefore: () => ReturnType;
      moveFigureUp: () => ReturnType;
      moveFigureDown: () => ReturnType;
    };
  }
}

function figureClass(layout: ImageLayout, selected: boolean): string {
  return ["md-figure", `md-layout-${layout}`, selected ? "is-selected" : ""].filter(Boolean).join(" ");
}

function posValid(state: EditorState, pos: number | null | undefined): pos is number {
  return pos != null && state.doc.nodeAt(pos)?.type.name === "figure";
}

function firstFigurePos(state: EditorState): number | null {
  const resolved = figurePosFromState(state);
  return posValid(state, resolved) ? resolved : null;
}

export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  defining: true,
  draggable: false,
  selectable: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
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
            caption: captionAttr(el.querySelector("figcaption")?.textContent),
            width: parseWidthPercent(el.getAttribute("data-width") || img?.getAttribute("width")),
            layout: isImageLayout(layout) ? layout : DEFAULT_IMAGE_LAYOUT,
            label: el.getAttribute("data-label")
          };
        }
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
            caption: "",
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
    const caption = captionAttr(HTMLAttributes.caption);
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
      ...(caption ? ([["figcaption", { class: "md-caption" }, caption]] as const) : [])
    ];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => createFigureView({ node, editor, getPos });
  },
  addCommands() {
    return {
      setFigure:
        (attrs) =>
        ({ state, dispatch }) => {
          const tr = insertFigureTransaction(state, state.selection.from, attrs);
          if (!tr) return false;
          dispatch?.(tr);
          return true;
        },
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
            caption: attrs.caption != null ? captionAttr(attrs.caption) : captionAttr(figure.attrs.caption),
            width: clampImageWidth(Number(attrs.width ?? figure.attrs.width ?? DEFAULT_IMAGE_WIDTH)),
            layout: isImageLayout(attrs.layout) ? attrs.layout : isImageLayout(figure.attrs.layout) ? figure.attrs.layout : DEFAULT_IMAGE_LAYOUT
          };
          if (
            next.width === figure.attrs.width &&
            next.layout === figure.attrs.layout &&
            next.alt === figure.attrs.alt &&
            next.src === figure.attrs.src &&
            next.caption === captionAttr(figure.attrs.caption) &&
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
        ({ state, dispatch }) => {
          const pos = firstFigurePos(state);
          if (pos == null) return false;
          const figure = state.doc.nodeAt(pos);
          if (!figure || figure.type.name !== "figure") return false;
          const caption = captionAttr(text);
          if (captionAttr(figure.attrs.caption) === caption) return true;
          dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...figure.attrs, caption }));
          return true;
        },
      exitFigureAfter:
        () =>
        ({ state, dispatch }) =>
          exitFigureAfter(state, dispatch),
      exitFigureBefore:
        () =>
        ({ state, dispatch }) =>
          exitFigureBefore(state, dispatch),
      moveFigureUp:
        () =>
        ({ state, dispatch }) => {
          const pos = firstFigurePos(state);
          if (pos == null) return false;
          return moveFigureBy(state, pos, -1, dispatch);
        },
      moveFigureDown:
        () =>
        ({ state, dispatch }) => {
          const pos = firstFigurePos(state);
          if (pos == null) return false;
          return moveFigureBy(state, pos, 1, dispatch);
        }
    };
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (figurePosFromSelection(editor.state) == null) return false;
        return editor.commands.exitFigureAfter();
      },
      ArrowDown: ({ editor }) => {
        const sel = editor.state.selection;
        if (sel instanceof NodeSelection && sel.node.type.name === "figure") {
          return editor.commands.exitFigureAfter();
        }
        return false;
      },
      ArrowUp: ({ editor }) => {
        const sel = editor.state.selection;
        if (sel instanceof NodeSelection && sel.node.type.name === "figure") {
          return editor.commands.exitFigureBefore();
        }
        return false;
      },
      "Alt-ArrowUp": ({ editor }) => editor.commands.moveFigureUp(),
      "Alt-ArrowDown": ({ editor }) => editor.commands.moveFigureDown()
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
            if (tr.selectionSet) return null;
            if (value == null) return null;
            const mapped = tr.docChanged ? tr.mapping.map(value) : value;
            return state.doc.nodeAt(mapped)?.type.name === "figure" ? mapped : null;
          }
        },
        appendTransaction(_trs, _old, state) {
          if (!needsTrailingWritable(state.doc)) return null;
          const paragraph = state.schema.nodes.paragraph?.create();
          if (!paragraph) return null;
          return state.tr.insert(state.doc.content.size, paragraph);
        },
        props: {
          handleTextInput(view, _from, _to, text) {
            const sel = view.state.selection;
            if (!(sel instanceof NodeSelection) || sel.node.type.name !== "figure") return false;
            if (!exitFigureAfter(view.state, (tr: Transaction) => view.dispatch(tr))) return false;
            view.dispatch(view.state.tr.insertText(text));
            return true;
          },
          handleClick(view, _pos, event) {
            return handleFigureAreaClick(view, event);
          }
        }
      })
    ];
  }
});
