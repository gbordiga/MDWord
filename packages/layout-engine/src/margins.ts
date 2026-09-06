import { toMm } from "@mdword/shared";

export type MarginBox = {
  top: string;
  right: string;
  bottom: string;
  left: string;
};

export interface MarginPreset {
  id: string;
  name: string;
  description: string;
  margins: MarginBox;
}

/** Word-like presets, stored as CSS lengths in millimetres. */
export const MARGIN_PRESETS: MarginPreset[] = [
  {
    id: "normal",
    name: "Normal",
    description: "20mm top, right and bottom; 25mm left",
    margins: { top: "20mm", right: "20mm", bottom: "20mm", left: "25mm" }
  },
  {
    id: "narrow",
    name: "Narrow",
    description: "12.7mm on all sides",
    margins: { top: "12.7mm", right: "12.7mm", bottom: "12.7mm", left: "12.7mm" }
  },
  {
    id: "moderate",
    name: "Moderate",
    description: "25mm top and bottom; 19mm left and right",
    margins: { top: "25mm", right: "19mm", bottom: "25mm", left: "19mm" }
  },
  {
    id: "wide",
    name: "Wide",
    description: "25mm top and bottom; 50mm left and right",
    margins: { top: "25mm", right: "50mm", bottom: "25mm", left: "50mm" }
  },
  {
    id: "office",
    name: "Office",
    description: "25mm on all sides",
    margins: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" }
  }
];

export function mmString(mm: number): string {
  const rounded = Math.round(Math.max(0, mm) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}mm`;
}

export function lengthToMm(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  try {
    return toMm(input);
  } catch {
    return fallback;
  }
}

export function clampMarginMm(mm: number, pageMm: number): number {
  const max = Math.max(8, pageMm * 0.4);
  return Math.min(max, Math.max(8, mm));
}

export function matchMarginPreset(margins: Partial<MarginBox> | undefined): string {
  if (!margins) return "normal";
  const current = {
    top: lengthToMm(margins.top, 20),
    right: lengthToMm(margins.right, 20),
    bottom: lengthToMm(margins.bottom, 20),
    left: lengthToMm(margins.left, 25)
  };
  for (const preset of MARGIN_PRESETS) {
    const same =
      Math.abs(lengthToMm(preset.margins.top, 0) - current.top) < 0.15 &&
      Math.abs(lengthToMm(preset.margins.right, 0) - current.right) < 0.15 &&
      Math.abs(lengthToMm(preset.margins.bottom, 0) - current.bottom) < 0.15 &&
      Math.abs(lengthToMm(preset.margins.left, 0) - current.left) < 0.15;
    if (same) return preset.id;
  }
  return "custom";
}
