import { Node, mergeAttributes } from "@tiptap/core";

export const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      target: { default: "" },
      section: { default: null },
      label: { default: "" },
      broken: { default: false }
    };
  },
  parseHTML() {
    return [{ tag: "span[data-wiki-link]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const broken = Boolean(HTMLAttributes.broken);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": "",
        "data-target": HTMLAttributes.target ?? "",
        "data-testid": "wikilink",
        class: broken ? "wikilink md-wikilink broken" : "wikilink md-wikilink",
        title: "Ctrl+click to open"
      }),
      HTMLAttributes.label || HTMLAttributes.target
    ];
  }
});

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { kind: { default: "note" } };
  },
  parseHTML() {
    return [{ tag: "aside[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, {
        "data-callout": HTMLAttributes.kind,
        class: `callout callout-${HTMLAttributes.kind}`
      }),
      0
    ];
  }
});

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },
  renderHTML() {
    return ["div", { "data-page-break": "", class: "page-break-block" }];
  }
});

export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "image caption?",
  addAttributes() {
    return {
      label: { default: null },
      align: { default: "block-center" }
    };
  },
  parseHTML() {
    return [{ tag: "figure" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { class: "md-figure" }), 0];
  }
});

export const Caption = Node.create({
  name: "caption",
  content: "inline*",
  parseHTML() {
    return [{ tag: "figcaption" }];
  },
  renderHTML() {
    return ["figcaption", { class: "md-caption" }, 0];
  }
});

export const MystRaw = Node.create({
  name: "mystRaw",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      name: { default: "unknown" },
      source: { default: "" }
    };
  },
  parseHTML() {
    return [{ tag: "pre[data-myst-raw]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, { "data-myst-raw": "", class: "myst-raw" }),
      HTMLAttributes.source || `::: {${HTMLAttributes.name}}\n:::`
    ];
  }
});
