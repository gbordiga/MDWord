import { Mark, mergeAttributes } from "@tiptap/core";
import { Node } from "@tiptap/core";

export const Subscript = Mark.create({
  name: "subscript",
  parseHTML() {
    return [{ tag: "sub" }];
  },
  renderHTML() {
    return ["sub", 0];
  }
});

export const Superscript = Mark.create({
  name: "superscript",
  parseHTML() {
    return [{ tag: "sup" }];
  },
  renderHTML() {
    return ["sup", 0];
  }
});

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-inline-math]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-inline-math": "",
        class: "md-inline-math",
        "data-latex": HTMLAttributes.latex
      }),
      HTMLAttributes.latex
    ];
  }
});

export const CiteChip = Node.create({
  name: "citeChip",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { key: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-cite-chip]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-cite-chip": "",
        class: "md-cite-chip",
        title: HTMLAttributes.key
      }),
      `[${HTMLAttributes.key}]`
    ];
  }
});

export const CrossRefChip = Node.create({
  name: "crossRefChip",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      label: { default: "" },
      kind: { default: "ref" },
      display: { default: "?" }
    };
  },
  parseHTML() {
    return [{ tag: "span[data-cross-ref]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-cross-ref": "",
        class: "md-cross-ref-chip",
        "data-label": HTMLAttributes.label,
        "data-kind": HTMLAttributes.kind
      }),
      HTMLAttributes.display || HTMLAttributes.label
    ];
  }
});

export const FootnoteRef = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      identifier: { default: "" },
      number: { default: "?" }
    };
  },
  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-ref": "",
        class: "md-footnote-ref"
      }),
      HTMLAttributes.number
    ];
  }
});

export const Abbreviation = Mark.create({
  name: "abbreviation",
  addAttributes() {
    return { title: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "abbr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["abbr", mergeAttributes(HTMLAttributes, { title: HTMLAttributes.title }), 0];
  }
});
