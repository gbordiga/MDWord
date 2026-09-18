/** MyST spec node kinds MDWord treats as first-class (editable in visual mode). */
export const MYST_SPEC_BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "thematicBreak",
  "blockquote",
  "list",
  "listItem",
  "code",
  "table",
  "tableRow",
  "tableCell",
  "admonition",
  "admonitionTitle",
  "container",
  "caption",
  "legend",
  "math",
  "footnoteDefinition",
  "figure",
  "image",
  "mystTarget",
  "mystComment",
  "block",
  "blockBreak"
]);

export const MYST_SPEC_INLINE_NODES = new Set([
  "text",
  "strong",
  "emphasis",
  "delete",
  "inlineCode",
  "break",
  "link",
  "imageReference",
  "inlineMath",
  "subscript",
  "superscript",
  "underline",
  "abbreviation",
  "crossReference",
  "footnoteReference",
  "cite"
]);

export const MYST_CALLOUT_KINDS = [
  "note",
  "tip",
  "warning",
  "important",
  "attention",
  "caution",
  "danger",
  "error",
  "hint",
  "seealso",
  "admonition"
] as const;

export type MystCalloutKind = (typeof MYST_CALLOUT_KINDS)[number];

export const MYST_TABLE_DIRECTIVES = new Set(["table", "list-table", "csv-table"]);

export const MYST_KNOWN_DIRECTIVES = new Set([
  ...MYST_CALLOUT_KINDS,
  "figure",
  "image",
  "code",
  "code-block",
  "math",
  "equation",
  ...MYST_TABLE_DIRECTIVES,
  "include",
  "toc",
  "contents",
  "page-break",
  "mermaid",
  "iframe"
]);

export const MYST_KNOWN_ROLES = new Set([
  "cite",
  "ref",
  "numref",
  "eq",
  "math",
  "subscript",
  "superscript",
  "underline",
  "abbr",
  "abbreviation"
]);

export function isMystCalloutKind(name: string): name is MystCalloutKind {
  return (MYST_CALLOUT_KINDS as readonly string[]).includes(name);
}
