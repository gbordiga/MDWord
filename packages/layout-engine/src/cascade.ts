import type { Mdoc } from "./schema";
import { mdocSchema } from "./schema";
import { applyFontScale } from "./typeScale";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overlay: Record<string, unknown>
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const current = out[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export interface CascadeInput {
  application: Mdoc;
  workspace?: Mdoc;
  template?: Mdoc;
  document?: Mdoc;
}

/**
 * CSS-like cascade. Later layers win. Arrays and scalars replace.
 * Pure: no UI, no IO.
 */
export function resolveMdoc(input: CascadeInput): Mdoc {
  let acc: Record<string, unknown> = { version: 1 };
  for (const layer of [
    input.application,
    input.workspace,
    input.template,
    input.document
  ]) {
    if (!layer) continue;
    acc = deepMerge(acc, layer as Record<string, unknown>);
  }
  return applyFontScale(mdocSchema.parse(acc));
}

/** Fields written into every new document so layout is explicit, not implied. */
export const NEW_DOCUMENT_MDOC: Mdoc = {
  version: 1,
  page: { size: "A4", orientation: "portrait" },
  margins: { top: "20mm", right: "20mm", bottom: "20mm", left: "25mm" },
  fontScale: "medium",
  header: { left: "{{title}}", center: "", right: "{{page}} / {{pages}}" },
  footer: { left: "", center: "", right: "{{date}}" },
  numbering: { headings: false, figures: true, tables: true },
  toc: { enabled: false, depth: 3 }
};

export const APPLICATION_DEFAULTS: Mdoc = {
  version: 1,
  page: NEW_DOCUMENT_MDOC.page,
  margins: NEW_DOCUMENT_MDOC.margins,
  typography: {
    body: {
      "font-family": "Aptos, Calibri, Carlito, 'Segoe UI', system-ui, sans-serif",
      "font-size": "11pt",
      "line-height": 1.15
    },
    "heading-1": { "font-size": "20pt", weight: 600 },
    "heading-2": { "font-size": "16pt", weight: 600 },
    "heading-3": { "font-size": "14pt", weight: 600 },
    "heading-4": { "font-size": "12pt", weight: 600 },
    title: { "font-size": "28pt", weight: 700 },
    subtitle: { "font-size": "14pt" },
    caption: { "font-size": "10pt" },
    quote: { "font-size": "11pt" },
    code: { "font-family": "Consolas, 'Liberation Mono', ui-monospace, monospace" }
  },
  header: NEW_DOCUMENT_MDOC.header,
  footer: NEW_DOCUMENT_MDOC.footer,
  numbering: NEW_DOCUMENT_MDOC.numbering,
  toc: NEW_DOCUMENT_MDOC.toc
};
