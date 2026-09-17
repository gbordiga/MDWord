"use client";

import { type PointerEvent as ReactPointerEvent } from "react";
import { clampMarginMm, mmString, type PageMetrics } from "@mdword/layout-engine";

type Side = "top" | "right" | "bottom" | "left";

const PX_PER_MM = 96 / 25.4;
export const RULER = 22;

function startMarginDrag(
  side: Side,
  metrics: PageMetrics,
  scale: number,
  onChange: (margins: { top: string; right: string; bottom: string; left: string }) => void
) {
  return (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const start = {
      top: metrics.margins.top / PX_PER_MM,
      right: metrics.margins.right / PX_PER_MM,
      bottom: metrics.margins.bottom / PX_PER_MM,
      left: metrics.margins.left / PX_PER_MM
    };
    const factor = 1 / (PX_PER_MM * Math.max(scale, 0.05));

    const move = (e: PointerEvent) => {
      const dxMm = (e.clientX - startX) * factor;
      const dyMm = (e.clientY - startY) * factor;
      const next = { ...start };
      if (side === "left") next.left = clampMarginMm(start.left + dxMm, metrics.widthMm);
      if (side === "right") next.right = clampMarginMm(start.right - dxMm, metrics.widthMm);
      if (side === "top") next.top = clampMarginMm(start.top + dyMm, metrics.heightMm);
      if (side === "bottom") next.bottom = clampMarginMm(start.bottom - dyMm, metrics.heightMm);
      onChange({
        top: mmString(next.top),
        right: mmString(next.right),
        bottom: mmString(next.bottom),
        left: mmString(next.left)
      });
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
}

function marginTicks(
  lengthMm: number,
  pxPerMm: number,
  origin: number,
  axis: "x" | "y",
  toward: 1 | -1,
  scale: number
) {
  if (lengthMm < 0.5 || pxPerMm <= 0) return [];
  const majorEvery = scale < 0.55 ? 20 : 10;
  const step = scale < 0.55 ? 10 : 5;
  const marks: { pos: number; major: boolean; label?: string; key: string }[] = [];
  for (let mm = 0; mm <= lengthMm + 0.01; mm += step) {
    const major = mm % majorEvery === 0;
    marks.push({
      key: `${axis}-${toward}-${mm}`,
      pos: origin + toward * mm * pxPerMm,
      major,
      label: major && mm > 0 ? String(Math.round(mm)) : undefined
    });
  }
  const end = Math.round(lengthMm * 10) / 10;
  if (end > 0.5 && marks.every((mark) => Math.abs(mark.pos - (origin + toward * end * pxPerMm)) > 0.6)) {
    marks.push({
      key: `${axis}-${toward}-end`,
      pos: origin + toward * end * pxPerMm,
      major: true,
      label: Number.isInteger(end) ? String(end) : end.toFixed(1)
    });
  }
  return marks.map((mark) =>
    axis === "x" ? (
      <span
        key={mark.key}
        className={`absolute bottom-0 w-px ${mark.major ? "bg-[#98a2b3]" : "bg-[#d0d5dd]"}`}
        style={{ left: mark.pos, height: mark.major ? 7 : 4 }}
      >
        {mark.label ? (
          <span
            className={`absolute bottom-[8px] font-mono text-[8px] font-medium tabular-nums leading-none text-[#667085] ${
              toward < 0 ? "right-0.5" : "left-0.5"
            }`}
          >
            {mark.label}
          </span>
        ) : null}
      </span>
    ) : (
      <span
        key={mark.key}
        className={`absolute right-0 h-px ${mark.major ? "bg-[#98a2b3]" : "bg-[#d0d5dd]"}`}
        style={{ top: mark.pos, width: mark.major ? 7 : 4 }}
      >
        {mark.label ? (
          <span
            className={`absolute right-[8px] font-mono text-[8px] font-medium tabular-nums leading-none text-[#667085] ${
              toward < 0 ? "bottom-px" : "top-px"
            }`}
          >
            {mark.label}
          </span>
        ) : null}
      </span>
    )
  );
}

export function PageRulers({
  box,
  metrics,
  scale,
  onChange
}: {
  box: { x: number; y: number; w: number; h: number };
  metrics: PageMetrics;
  scale: number;
  onChange: (margins: { top: string; right: string; bottom: string; left: string }) => void;
}) {
  const pxPerMm = PX_PER_MM * scale;
  const left = metrics.margins.left * scale;
  const right = metrics.margins.right * scale;
  const top = metrics.margins.top * scale;
  const bottom = metrics.margins.bottom * scale;
  const pageLeft = box.x;
  const pageRight = box.x + box.w;
  const pageTop = box.y;
  const pageBottom = box.y + box.h;
  const contentX = pageLeft + left;
  const contentY = pageTop + top;
  const contentW = Math.max(0, box.w - left - right);
  const contentH = Math.max(0, box.h - top - bottom);
  const leftMm = metrics.margins.left / PX_PER_MM;
  const rightMm = metrics.margins.right / PX_PER_MM;
  const topMm = metrics.margins.top / PX_PER_MM;
  const bottomMm = metrics.margins.bottom / PX_PER_MM;
  const drag = (side: Side) => startMarginDrag(side, metrics, scale, onChange);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block" data-testid="page-rulers">
      <div
        className="absolute left-0 right-0 top-0 overflow-hidden border-b border-[#e4e7ec] bg-[#f7f8fa]/95 backdrop-blur-[2px]"
        style={{ height: RULER }}
        data-testid="ruler-horizontal"
      >
        <div
          className="absolute inset-y-0 bg-[#2563eb]/[0.07]"
          style={{ left: pageLeft, width: left }}
        />
        <div
          className="absolute inset-y-0 bg-[#2563eb]/[0.07]"
          style={{ left: pageRight - right, width: right }}
        />
        {marginTicks(leftMm, pxPerMm, pageLeft, "x", 1, scale)}
        {marginTicks(rightMm, pxPerMm, pageRight, "x", -1, scale)}
        <button
          type="button"
          aria-label="Drag left margin"
          data-testid="page-margin-left"
          title={`${leftMm.toFixed(1)} mm`}
          className="pointer-events-auto absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize"
          style={{ left: contentX }}
          onPointerDown={drag("left")}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#2563eb]/80" />
          <span className="absolute left-1/2 top-[3px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 rounded-[1.5px] bg-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
        </button>
        <button
          type="button"
          aria-label="Drag right margin"
          data-testid="page-margin-right"
          title={`${rightMm.toFixed(1)} mm`}
          className="pointer-events-auto absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize"
          style={{ left: contentX + contentW }}
          onPointerDown={drag("right")}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#2563eb]/80" />
          <span className="absolute left-1/2 top-[3px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 rounded-[1.5px] bg-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
        </button>
      </div>
      <div
        className="absolute bottom-0 left-0 top-0 overflow-hidden border-r border-[#e4e7ec] bg-[#f7f8fa]/95 backdrop-blur-[2px]"
        style={{ width: RULER }}
        data-testid="ruler-vertical"
      >
        <div
          className="absolute inset-x-0 bg-[#2563eb]/[0.07]"
          style={{ top: pageTop, height: top }}
        />
        <div
          className="absolute inset-x-0 bg-[#2563eb]/[0.07]"
          style={{ top: pageBottom - bottom, height: bottom }}
        />
        {marginTicks(topMm, pxPerMm, pageTop, "y", 1, scale)}
        {marginTicks(bottomMm, pxPerMm, pageBottom, "y", -1, scale)}
        <button
          type="button"
          aria-label="Drag top margin"
          data-testid="page-margin-top"
          title={`${topMm.toFixed(1)} mm`}
          className="pointer-events-auto absolute left-0 z-10 h-3 w-full -translate-y-1/2 cursor-ns-resize"
          style={{ top: contentY }}
          onPointerDown={drag("top")}
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#2563eb]/80" />
          <span className="absolute left-[3px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rotate-45 rounded-[1.5px] bg-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
        </button>
        <button
          type="button"
          aria-label="Drag bottom margin"
          data-testid="page-margin-bottom"
          title={`${bottomMm.toFixed(1)} mm`}
          className="pointer-events-auto absolute left-0 z-10 h-3 w-full -translate-y-1/2 cursor-ns-resize"
          style={{ top: contentY + contentH }}
          onPointerDown={drag("bottom")}
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#2563eb]/80" />
          <span className="absolute left-[3px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rotate-45 rounded-[1.5px] bg-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
        </button>
      </div>
      <div
        className="absolute left-0 top-0 border-b border-r border-[#e4e7ec] bg-[#f7f8fa]"
        style={{ width: RULER, height: RULER }}
      />
    </div>
  );
}
