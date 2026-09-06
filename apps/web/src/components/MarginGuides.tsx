"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { clampMarginMm, mmString, type PageMetrics } from "@mdword/layout-engine";

type Side = "top" | "right" | "bottom" | "left";

const PX_TO_MM = 25.4 / 96;

export function MarginGuides({
  metrics,
  scale,
  onChange
}: {
  metrics: PageMetrics;
  scale: number;
  onChange: (margins: { top: string; right: string; bottom: string; left: string }) => void;
}) {
  const startDrag = (side: Side) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const start = {
      top: metrics.margins.top * PX_TO_MM,
      right: metrics.margins.right * PX_TO_MM,
      bottom: metrics.margins.bottom * PX_TO_MM,
      left: metrics.margins.left * PX_TO_MM
    };
    const factor = PX_TO_MM / Math.max(scale, 0.05);

    const move = (e: PointerEvent) => {
      const dxMm = (e.clientX - startX) * factor;
      const dyMm = (e.clientY - startY) * factor;
      const next = { ...start };
      if (side === "left") next.left = clampMarginMm(next.left + dxMm, metrics.widthMm);
      if (side === "right") next.right = clampMarginMm(next.right - dxMm, metrics.widthMm);
      if (side === "top") next.top = clampMarginMm(next.top + dyMm, metrics.heightMm);
      if (side === "bottom") next.bottom = clampMarginMm(next.bottom - dyMm, metrics.heightMm);
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

  const m = metrics.margins;
  return (
    <div className="pointer-events-none absolute inset-0 max-lg:hidden" data-testid="margin-guides">
      <button
        type="button"
        aria-label="Drag top margin"
        data-testid="page-margin-top"
        className="pointer-events-auto absolute left-0 right-0 z-10 h-2 cursor-ns-resize bg-accent/0 hover:bg-accent/20"
        style={{ top: Math.max(0, m.top - 4) }}
        onPointerDown={startDrag("top")}
      />
      <button
        type="button"
        aria-label="Drag bottom margin"
        data-testid="page-margin-bottom"
        className="pointer-events-auto absolute left-0 right-0 z-10 h-2 cursor-ns-resize bg-accent/0 hover:bg-accent/20"
        style={{ bottom: Math.max(0, m.bottom - 4) }}
        onPointerDown={startDrag("bottom")}
      />
      <button
        type="button"
        aria-label="Drag left margin"
        data-testid="page-margin-left"
        className="pointer-events-auto absolute top-0 bottom-0 z-10 w-2 cursor-ew-resize bg-accent/0 hover:bg-accent/20"
        style={{ left: Math.max(0, m.left - 4) }}
        onPointerDown={startDrag("left")}
      />
      <button
        type="button"
        aria-label="Drag right margin"
        data-testid="page-margin-right"
        className="pointer-events-auto absolute top-0 bottom-0 z-10 w-2 cursor-ew-resize bg-accent/0 hover:bg-accent/20"
        style={{ right: Math.max(0, m.right - 4) }}
        onPointerDown={startDrag("right")}
      />
    </div>
  );
}
