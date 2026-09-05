export type LengthUnit = "mm" | "cm" | "in" | "pt";

export interface ParsedLength {
  value: number;
  unit: LengthUnit;
}

const LENGTH_RE = /^([0-9]+(?:\.[0-9]+)?)(mm|cm|in|pt)$/;

export function parseLength(input: string): ParsedLength {
  const match = LENGTH_RE.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid length: ${input}`);
  }
  return { value: Number(match[1]), unit: match[2] as LengthUnit };
}

export function isLength(input: string): boolean {
  return LENGTH_RE.test(input.trim());
}

/** Convert a CSS-like length to millimeters. */
export function toMm(input: string | ParsedLength): number {
  const parsed = typeof input === "string" ? parseLength(input) : input;
  switch (parsed.unit) {
    case "mm":
      return parsed.value;
    case "cm":
      return parsed.value * 10;
    case "in":
      return parsed.value * 25.4;
    case "pt":
      return parsed.value * (25.4 / 72);
  }
}

export function toPx(input: string | ParsedLength, dpi = 96): number {
  return (toMm(input) / 25.4) * dpi;
}

export function formatLength(value: number, unit: LengthUnit): string {
  const rounded = Number(value.toFixed(4)).toString();
  return `${rounded}${unit}`;
}
