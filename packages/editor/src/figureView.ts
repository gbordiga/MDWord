import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
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
import { clearFigureDropMark, moveFigureTo, updateFigureDropMark } from "./figureMove";

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
  contentDOM: HTMLElement;
  update: (updated: ProseNode) => boolean;
  selectNode: () => void;
  deselectNode: () => void;
  stopEvent: (event: Event) => boolean;
  destroy: () => void;
} {
  let current = node;
  let resizing = false;
  const dom = document.createElement("figure");
  const box = document.createElement("div");
  const img = document.createElement("img");
  const left = document.createElement("span");
  const right = document.createElement("span");
  const contentDOM = document.createElement("figcaption");
  box.className = "md-figure-box";
  contentDOM.className = "md-caption";
  contentDOM.dataset.placeholder = "Caption";
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
  dom.setAttribute("data-testid", "doc-figure");
  box.append(img, left, right);
  dom.append(box, contentDOM);

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
    const pos = posOf();
    const selected = editor.isActive("figure") && pos != null && editor.state.selection.from === pos;
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
  };

  apply(node);
  img.addEventListener("load", () => {
    if (img.naturalWidth && img.naturalHeight) {
      img.width = img.naturalWidth;
      img.height = img.naturalHeight;
    }
  });

  const selectFigure = () => {
    const pos = posOf();
    if (pos == null) return;
    const sel = editor.state.selection;
    if (sel instanceof NodeSelection && sel.from === pos) return;
    editor.chain().setNodeSelection(pos).run();
  };

  const startResize = (side: "left" | "right") => (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* capture is best-effort on older WebViews */
    }
    selectFigure();
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
        /* already released */
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

  const onImagePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const already = dom.classList.contains("is-selected");
    selectFigure();
    if (event.pointerType !== "mouse" && !already) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPos = posOf();
    const startSize = current.nodeSize;
    let dragging = false;
    let dropRaf = 0;
    let dropX = startX;
    let dropY = startY;
    try {
      img.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    const onMove = (move: PointerEvent) => {
      if (!samePointer(move, pointerId)) return;
      if (Math.hypot(move.clientX - startX, move.clientY - startY) < 12) return;
      if (!dragging) {
        dragging = true;
        beginFigureInteraction();
        dom.classList.add("is-dragging");
      }
      move.preventDefault();
      if (startPos == null) return;
      dropX = move.clientX;
      dropY = move.clientY;
      if (dropRaf) return;
      dropRaf = requestAnimationFrame(() => {
        dropRaf = 0;
        updateFigureDropMark(editor.view, startPos, startSize, dropX, dropY);
      });
    };
    const onEnd = (end: PointerEvent) => {
      if (!samePointer(end, pointerId)) return;
      img.removeEventListener("pointermove", onMove);
      img.removeEventListener("pointerup", onEnd);
      img.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      try {
        img.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      if (dropRaf) cancelAnimationFrame(dropRaf);
      clearFigureDropMark();
      dom.classList.remove("is-dragging");
      if (dragging) endFigureInteraction();
      if (!dragging) return;
      const pos = posOf();
      if (pos == null) return;
      moveFigureTo(editor.view, pos, end.clientX, end.clientY);
    };
    img.addEventListener("pointermove", onMove);
    img.addEventListener("pointerup", onEnd);
    img.addEventListener("pointercancel", onEnd);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };
  img.addEventListener("pointerdown", onImagePointerDown, { passive: false });

  const onCaptionPointerDown = (event: PointerEvent) => {
    if (editor.state.selection.$from.parent.type.name === "caption") return;
    event.stopPropagation();
    const pos = posOf();
    if (pos == null) return;
    editor.commands.ensureFigureCaption();
    const latest = posOf();
    if (latest == null) return;
    const figure = editor.state.doc.nodeAt(latest);
    const cap = figure?.firstChild;
    if (!cap || cap.type.name !== "caption") return;
    editor.chain().focus().setTextSelection(latest + 1 + cap.content.size).run();
  };
  contentDOM.addEventListener("pointerdown", onCaptionPointerDown);

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
    stopEvent(event) {
      const target = event.target as Node | null;
      if (target && (left.contains(target) || right.contains(target))) return true;
      if (resizing || dom.classList.contains("is-dragging")) return true;
      if (event.type === "dragstart") return true;
      return false;
    },
    destroy() {
      img.removeEventListener("pointerdown", onImagePointerDown);
      contentDOM.removeEventListener("pointerdown", onCaptionPointerDown);
      clearFigureDropMark();
    }
  };
}
