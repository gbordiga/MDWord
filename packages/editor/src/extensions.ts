import { Node, mergeAttributes } from "@tiptap/core";
import { MystRawView } from "./mystRawView";

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
        title: "Click to open"
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
    return {
      kind: { default: "note" },
      title: { default: null }
    };
  },
  parseHTML() {
    return [{ tag: "aside[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, {
        "data-callout": HTMLAttributes.kind,
        "data-title": HTMLAttributes.title ?? undefined,
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

export const MystRaw = Node.create({
  name: "mystRaw",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      name: { default: "unknown" },
      source: { default: "" },
      options: { default: null }
    };
  },
  parseHTML() {
    return [{ tag: "div[data-myst-raw]" }, { tag: "pre[data-myst-raw]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-myst-raw": "", class: "md-myst-raw-card" }),
      HTMLAttributes.source || `::: {${HTMLAttributes.name}}\n:::`
    ];
  },
  addNodeView() {
    return MystRawView;
  }
});
