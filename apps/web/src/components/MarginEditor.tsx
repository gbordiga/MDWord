"use client";

import { MARGIN_PRESETS, matchMarginPreset, type Mdoc } from "@mdword/layout-engine";

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
  const presetId = matchMarginPreset(resolved.margins);

  return (
    <div data-testid="margin-editor">
      <label className="mb-2 block text-[11px] font-medium text-[#667085]">
        Preset
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
      <p className="mb-2 text-[12px] text-[#667085]">Drag the markers on the rulers, or type millimetres.</p>
      <div className="grid grid-cols-2 gap-2">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <label key={side} className="block capitalize text-[11px] font-medium text-[#667085]">
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
