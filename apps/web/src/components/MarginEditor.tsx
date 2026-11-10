"use client";

import { MARGIN_PRESETS, matchMarginPreset, type Mdoc } from "@mdword/layout-engine";

import { Field, fieldClass } from "./propertyUi";

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

  const input = (side: "top" | "bottom" | "left" | "right", extra: string) => (
    <input
      aria-label={`${side[0]!.toUpperCase()}${side.slice(1)} margin`}
      data-testid={`prop-margin-${side}`}
      className={`${fieldClass} min-w-0 text-center ${extra}`}
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
  );

  return (
    <div data-testid="margin-editor">
      <Field label="Preset">
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
      </Field>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-1.5" role="group" aria-label="Margins on the page">
        <div className="col-span-3 flex justify-center">{input("top", "!w-24")}</div>
        {input("left", "!px-1")}
        <div aria-hidden className="mx-auto h-14 w-10 rounded-sm border border-[#d0d5dd] bg-[#f9fafb] shadow-sm">
          <div className="m-1.5 h-[calc(100%-0.75rem)] rounded-[1px] border border-dashed border-[#b2bcd0]" />
        </div>
        {input("right", "!px-1")}
        <div className="col-span-3 flex justify-center">{input("bottom", "!w-24")}</div>
      </div>
    </div>
  );
}
