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

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (attrs: Partial<FigureAttrs> & { src: string }) => ReturnType;
      updateFigure: (attrs: Partial<FigureAttrs>) => ReturnType;
      setFigureCaption: (text: string) => ReturnType;
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

export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "caption?",
  defining: true,
  draggable: true,
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
    return ({ node, editor, getPos }) => {
      let current = node;
      const dom = document.createElement("figure");
      const box = document.createElement("div");
      const img = document.createElement("img");
      const left = document.createElement("button");
      const right = document.createElement("button");
      const contentDOM = document.createElement("figcaption");
      box.className = "md-figure-box";
      contentDOM.className = "md-caption";
      left.type = "button";
      right.type = "button";
      left.className = "md-figure-resize md-figure-resize-left";
      right.className = "md-figure-resize md-figure-resize-right";
      left.tabIndex = -1;
      right.tabIndex = -1;
      left.setAttribute("aria-label", "Resize image");
      right.setAttribute("aria-label", "Resize image");
      img.setAttribute("data-testid", "doc-image");
      dom.setAttribute("data-testid", "doc-figure");
      box.append(img, left, right);
      dom.append(box, contentDOM);

      const apply = (current: typeof node) => {
        const width = clampImageWidth(Number(current.attrs.width ?? DEFAULT_IMAGE_WIDTH));
        const layout = isImageLayout(current.attrs.layout) ? current.attrs.layout : DEFAULT_IMAGE_LAYOUT;
        const selected = editor.isActive("figure") && typeof getPos === "function" && editor.state.selection.from === getPos();
        dom.className = figureClass(layout, selected);
        dom.dataset.width = String(width);
        dom.dataset.layout = layout;
        if (current.attrs.label) dom.dataset.label = String(current.attrs.label);
        else delete dom.dataset.label;
        img.src = String(current.attrs.src ?? "");
        img.alt = String(current.attrs.alt ?? "");
        box.style.width = `${width}%`;
        if (layout.startsWith("float")) {
          dom.style.width = `${width}%`;
          box.style.width = "100%";
        } else {
          dom.style.width = "";
        }
      };

      apply(node);

      const select = (event: Event) => {
        event.preventDefault();
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        editor.chain().setNodeSelection(pos).run();
      };
      img.addEventListener("mousedown", select);

      const startResize = (side: "left" | "right") => (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        editor.chain().setNodeSelection(pos).run();
        const startX = event.clientX;
        const startWidth = box.getBoundingClientRect().width;
        const parent = (dom.parentElement ?? dom).getBoundingClientRect().width || startWidth;
        const startPct = clampImageWidth(Number(current.attrs.width ?? DEFAULT_IMAGE_WIDTH));
        const onMove = (move: PointerEvent) => {
          const dx = move.clientX - startX;
          const signed = side === "left" ? -dx : dx;
          const next = clampImageWidth(((startWidth + signed) / parent) * 100);
          editor.commands.updateFigure({ width: next });
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        void startPct;
      };
      left.addEventListener("pointerdown", startResize("left"));
      right.addEventListener("pointerdown", startResize("right"));

      return {
        dom,
        contentDOM,
        update(updated) {
          if (updated.type.name !== "figure") return false;
          current = updated;
          apply(updated);
          return true;
        },
        selectNode() {
          dom.classList.add("is-selected");
        },
        deselectNode() {
          dom.classList.remove("is-selected");
        },
        destroy() {
          img.removeEventListener("mousedown", select);
        }
      };
    };
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
          const pos = resolveFigurePos(state);
          if (pos == null) return false;
          const figure = state.doc.nodeAt(pos);
          if (!figure || figure.type.name !== "figure") return false;
          const next = {
            ...figure.attrs,
            ...attrs,
            width: clampImageWidth(Number(attrs.width ?? figure.attrs.width ?? DEFAULT_IMAGE_WIDTH)),
            layout: isImageLayout(attrs.layout) ? attrs.layout : isImageLayout(figure.attrs.layout) ? figure.attrs.layout : DEFAULT_IMAGE_LAYOUT
          };
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, next);
            dispatch(tr);
          }
          return true;
        },
      setFigureCaption:
        (text) =>
        ({ state, tr, dispatch }) => {
          const pos = resolveFigurePos(state);
          if (pos == null) return false;
          const figure = state.doc.nodeAt(pos);
          if (!figure || figure.type.name !== "figure") return false;
          const captionType = state.schema.nodes.caption;
          if (!captionType) return false;
          const trimmed = text.trim();
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
    return [{ tag: "figcaption" }];
  },
  renderHTML() {
    return ["figcaption", { class: "md-caption" }, 0];
  }
});
