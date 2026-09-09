import type { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import {
  clampImageWidth,
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  isImageLayout,
  type ImageLayout
} from "./imageModel";
import { displayImageSrc } from "./imageDisplay";
import { beginFigureInteraction, endFigureInteraction } from "./figureInteraction";
import { captionAttr } from "./figureCaption";

function figureClass(layout: ImageLayout, selected: boolean): string {
  return ["md-figure", `md-layout-${layout}`, selected ? "is-selected" : ""].filter(Boolean).join(" ");
}

function applyWidth(dom: HTMLElement, box: HTMLElement, layout: ImageLayout, width: number): void {
  if (layout.startsWith("float")) {
    dom.style.width = `${width}%`;
    box.style.width = "100%";
  } else {
    dom.style.width = "";
    box.style.width = `${width}%`;
  }
}

function contentWidth(dom: HTMLElement): number {
  const cell = dom.closest("td, th");
  const host = (cell ?? dom.parentElement ?? dom) as HTMLElement;
  return host.getBoundingClientRect().width || 1;
}

function samePointer(event: PointerEvent, pointerId: number): boolean {
  return event.pointerId === pointerId;
}

export function createFigureView({
  node,
  editor,
  getPos
}: {
  node: ProseNode;
  editor: Editor;
  getPos: (() => number | undefined) | boolean;
}): {
  dom: HTMLElement;
  update: (updated: ProseNode) => boolean;
  selectNode: () => void;
  deselectNode: () => void;
  stopEvent: (event: Event) => boolean;
  destroy: () => void;
} {
  let current = node;
  let resizing = false;
  let selected = false;
  const dom = document.createElement("figure");
  const box = document.createElement("div");
  const img = document.createElement("img");
  const caption = document.createElement("figcaption");
  const left = document.createElement("span");
  const right = document.createElement("span");
  box.className = "md-figure-box";
  caption.className = "md-caption";
  left.className = "md-figure-resize md-figure-resize-left";
  right.className = "md-figure-resize md-figure-resize-right";
  left.setAttribute("role", "slider");
  right.setAttribute("role", "slider");
  left.setAttribute("aria-label", "Resize image");
  right.setAttribute("aria-label", "Resize image");
  left.dataset.testid = "figure-resize-left";
  right.dataset.testid = "figure-resize-right";
  img.setAttribute("data-testid", "doc-image");
  img.decoding = "async";
  img.draggable = false;
  img.setAttribute("draggable", "false");
  caption.dataset.testid = "doc-caption";
  dom.setAttribute("data-testid", "doc-figure");
  box.append(img, left, right);
  dom.append(box, caption);

  const posOf = (): number | null => {
    if (typeof getPos !== "function") return null;
    const pos = getPos();
    return typeof pos === "number" ? pos : null;
  };

  let shownSrc = "";
  const apply = (next: ProseNode) => {
    if (resizing) return;
    const width = clampImageWidth(Number(next.attrs.width ?? DEFAULT_IMAGE_WIDTH));
    const layout = isImageLayout(next.attrs.layout) ? next.attrs.layout : DEFAULT_IMAGE_LAYOUT;
    dom.className = figureClass(layout, selected);
    dom.dataset.width = String(width);
    dom.dataset.layout = layout;
    if (next.attrs.label) dom.dataset.label = String(next.attrs.label);
    else delete dom.dataset.label;
    const nextSrc = String(next.attrs.src ?? "");
    if (nextSrc !== shownSrc) {
      shownSrc = nextSrc;
      img.src = displayImageSrc(nextSrc);
    }
    const nextAlt = String(next.attrs.alt ?? "");
    if (img.alt !== nextAlt) img.alt = nextAlt;
    applyWidth(dom, box, layout, width);
    const text = captionAttr(next.attrs.caption);
    caption.textContent = text;
    caption.hidden = !text;
  };

  apply(node);

  const startResize = (side: "left" | "right") => (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    const pos = posOf();
    if (pos != null) editor.chain().focus().setNodeSelection(pos).run();
    resizing = true;
    beginFigureInteraction();
    box.classList.add("is-resizing");
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = box.getBoundingClientRect().width;
    const parent = contentWidth(dom);
    let lastPct = clampImageWidth(Number(current.attrs.width ?? DEFAULT_IMAGE_WIDTH));
    const layout = isImageLayout(current.attrs.layout) ? current.attrs.layout : DEFAULT_IMAGE_LAYOUT;
    let raf = 0;
    let pendingPct = lastPct;

    const paint = () => {
      raf = 0;
      lastPct = pendingPct;
      applyWidth(dom, box, layout, lastPct);
      dom.dataset.width = String(lastPct);
    };
    const onMove = (move: PointerEvent) => {
      if (!samePointer(move, pointerId)) return;
      move.preventDefault();
      const dx = move.clientX - startX;
      const signed = side === "left" ? -dx : dx;
      pendingPct = clampImageWidth(((startWidth + signed) / parent) * 100);
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onEnd = (end: PointerEvent) => {
      if (!samePointer(end, pointerId)) return;
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      if (raf) {
        cancelAnimationFrame(raf);
        paint();
      }
      resizing = false;
      box.classList.remove("is-resizing");
      endFigureInteraction();
      if (lastPct !== clampImageWidth(Number(current.attrs.width ?? DEFAULT_IMAGE_WIDTH))) {
        editor.commands.updateFigure({ width: lastPct });
      }
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  left.addEventListener("pointerdown", startResize("left"), { passive: false });
  right.addEventListener("pointerdown", startResize("right"), { passive: false });

  return {
    dom,
    update(updated) {
      if (updated.type.name !== "figure") return false;
      current = updated;
      apply(updated);
      return true;
    },
    selectNode() {
      selected = true;
      dom.classList.add("is-selected");
    },
    deselectNode() {
      selected = false;
      dom.classList.remove("is-selected");
    },
    stopEvent(event) {
      const target = event.target as Node | null;
      if (target && (left.contains(target) || right.contains(target))) return true;
      if (resizing) return true;
      if (event.type === "dragstart") return true;
      return false;
    },
    destroy() {
      /* listeners are on nodes that go away with the view */
    }
  };
}
