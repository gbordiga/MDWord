"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import {
  MARGIN_PRESETS,
  clampMarginMm,
  lengthToMm,
  matchMarginPreset,
  mmString,
  pageMetrics,
  type Mdoc
} from "@mdword/layout-engine";

const fieldClass =
  "mt-1 w-full rounded-md border border-[#e4e7ec] px-3 py-2 text-[16px] lg:px-2 lg:py-1 lg:text-[13px]";

export function MarginEditor({
  mdoc,
  resolved,
  onChange
}: {
  mdoc: Mdoc;
  resolved: Mdoc;
  onChange: (margins: { top: string; right: string; bottom: string; left: string }) => void;
}) {
  const metrics = pageMetrics(resolved);
  const margins = {
    top: lengthToMm(resolved.margins?.top, 20),
    right: lengthToMm(resolved.margins?.right, 20),
    bottom: lengthToMm(resolved.margins?.bottom, 20),
    left: lengthToMm(resolved.margins?.left, 25)
  };
  const presetId = matchMarginPreset(resolved.margins);
  const previewW = 148;
  const previewH = (previewW * metrics.heightMm) / metrics.widthMm;
  const scale = previewW / metrics.widthMm;
  const box = {
    top: margins.top * scale,
    right: margins.right * scale,
    bottom: margins.bottom * scale,
    left: margins.left * scale
  };

  const drag = (side: "top" | "right" | "bottom" | "left") => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...margins };

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const next = { ...start };
      if (side === "left") next.left = clampMarginMm(start.left + dx, metrics.widthMm);
      if (side === "right") next.right = clampMarginMm(start.right - dx, metrics.widthMm);
      if (side === "top") next.top = clampMarginMm(start.top + dy, metrics.heightMm);
      if (side === "bottom") next.bottom = clampMarginMm(start.bottom - dy, metrics.heightMm);
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

  return (
    <div data-testid="margin-editor">
      <label className="mb-2 block">
        Margins
        <select
          aria-label="Margin preset"
          data-testid="margin-preset"
          className={fieldClass}
          value={presetId}
          onChange={(e) => {
            const preset = MARGIN_PRESETS.find((p) => p.id === e.target.value);
            if (preset) onChange(preset.margins);
          }}
        >
          {MARGIN_PRESETS.map((p) => (
            <option key={p.id} value={p.id} title={p.description}>
              {p.name}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>
      <p className="mb-2 text-[12px] text-[#667085]">
        Drag the blue edges on the page diagram, or type millimetres.
      </p>
      <div className="mb-3 flex justify-center py-2">
        <div
          data-testid="margin-preview"
          className="relative bg-[#eef2f6] shadow-sm"
          style={{ width: previewW, height: previewH }}
        >
          <div
            className="absolute bg-white"
            style={{
              top: box.top,
              right: box.right,
              bottom: box.bottom,
              left: box.left
            }}
          />
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-label={`Adjust ${side} margin`}
              data-testid={`margin-handle-${side}`}
              className={`absolute bg-accent/80 ${
                side === "top" || side === "bottom" ? "h-1.5 cursor-ns-resize" : "w-1.5 cursor-ew-resize"
              }`}
              style={
                side === "top"
                  ? { top: Math.max(0, box.top - 3), left: box.left, right: box.right }
                  : side === "bottom"
                    ? { bottom: Math.max(0, box.bottom - 3), left: box.left, right: box.right }
                    : side === "left"
                      ? { left: Math.max(0, box.left - 3), top: box.top, bottom: box.bottom }
                      : { right: Math.max(0, box.right - 3), top: box.top, bottom: box.bottom }
              }
              onPointerDown={drag(side)}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <label key={side} className="block capitalize">
            {side}
            <input
              data-testid={`prop-margin-${side}`}
              className={fieldClass}
              value={String(mdoc.margins?.[side] ?? resolved.margins?.[side] ?? "")}
              onChange={(e) =>
                onChange({
                  top: String(mdoc.margins?.top ?? resolved.margins?.top ?? "20mm"),
                  right: String(mdoc.margins?.right ?? resolved.margins?.right ?? "20mm"),
                  bottom: String(mdoc.margins?.bottom ?? resolved.margins?.bottom ?? "20mm"),
                  left: String(mdoc.margins?.left ?? resolved.margins?.left ?? "25mm"),
                  [side]: e.target.value
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
