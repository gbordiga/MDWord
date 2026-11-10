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
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <Field key={side} label={`${side[0]!.toUpperCase()}${side.slice(1)}`}>
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
          </Field>
        ))}
      </div>
    </div>
  );
}
