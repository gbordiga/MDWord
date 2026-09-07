import type { Mdoc, TextStyle } from "./schema";

export type FontScaleId = "extra-small" | "small" | "medium" | "large" | "extra-large";

export interface FontScalePreset {
  id: FontScaleId;
  name: string;
  description: string;
  body: string;
  lineHeight: number;
  title: string;
  subtitle: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  caption: string;
  quote: string;
}

export const FONT_SCALES: FontScalePreset[] = [
  {
    id: "extra-small",
    name: "Extra small",
    description: "9pt body",
    body: "9pt",
    lineHeight: 1.2,
    title: "18pt",
    subtitle: "11pt",
    h1: "14pt",
    h2: "12pt",
    h3: "11pt",
    h4: "10pt",
    caption: "8pt",
    quote: "9pt"
  },
  {
    id: "small",
    name: "Small",
    description: "10pt body",
    body: "10pt",
    lineHeight: 1.2,
    title: "22pt",
    subtitle: "12pt",
    h1: "16pt",
    h2: "13pt",
    h3: "12pt",
    h4: "11pt",
    caption: "9pt",
    quote: "10pt"
  },
  {
    id: "medium",
    name: "Medium",
    description: "11pt body",
    body: "11pt",
    lineHeight: 1.15,
    title: "28pt",
    subtitle: "14pt",
    h1: "20pt",
    h2: "16pt",
    h3: "14pt",
    h4: "12pt",
    caption: "10pt",
    quote: "11pt"
  },
  {
    id: "large",
    name: "Large",
    description: "13pt body",
    body: "13pt",
    lineHeight: 1.2,
    title: "32pt",
    subtitle: "16pt",
    h1: "24pt",
    h2: "18pt",
    h3: "15pt",
    h4: "13pt",
    caption: "11pt",
    quote: "13pt"
  },
  {
    id: "extra-large",
    name: "Extra large",
    description: "16pt body",
    body: "16pt",
    lineHeight: 1.25,
    title: "36pt",
    subtitle: "18pt",
    h1: "28pt",
    h2: "22pt",
    h3: "18pt",
    h4: "16pt",
    caption: "12pt",
    quote: "16pt"
  }
];

function withSize(style: TextStyle | undefined, fontSize: string, extra?: Partial<TextStyle>): TextStyle {
  return { ...style, "font-size": fontSize, ...extra };
}

export function getFontScale(id: FontScaleId): FontScalePreset {
  return FONT_SCALES.find((preset) => preset.id === id) ?? FONT_SCALES[2]!;
}

/** Apply a named type scale onto resolved typography. Document `fontScale` wins over template point sizes. */
export function applyFontScale(mdoc: Mdoc): Mdoc {
  if (!mdoc.fontScale) return mdoc;
  const scale = getFontScale(mdoc.fontScale);
  const typography = mdoc.typography ?? {};
  return {
    ...mdoc,
    typography: {
      ...typography,
      body: withSize(typography.body, scale.body, { "line-height": scale.lineHeight }),
      title: withSize(typography.title, scale.title),
      subtitle: withSize(typography.subtitle, scale.subtitle),
      "heading-1": withSize(typography["heading-1"], scale.h1),
      "heading-2": withSize(typography["heading-2"], scale.h2),
      "heading-3": withSize(typography["heading-3"], scale.h3),
      "heading-4": withSize(typography["heading-4"], scale.h4),
      caption: withSize(typography.caption, scale.caption),
      quote: withSize(typography.quote, scale.quote)
    }
  };
}

export function matchFontScale(mdoc: Mdoc): FontScaleId | "custom" {
  if (mdoc.fontScale && FONT_SCALES.some((preset) => preset.id === mdoc.fontScale)) {
    return mdoc.fontScale;
  }
  const body = mdoc.typography?.body?.["font-size"];
  const hit = FONT_SCALES.find((preset) => preset.body === body);
  return hit?.id ?? "custom";
}
