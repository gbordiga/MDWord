import type { GenericNode } from "@mdword/shared";

import {

  encodeWikiHref,

  formatImageAttrList,

  getTableMeta,

  withTableMeta,

  type TableMeta

} from "@mdword/shared";

import type { TiptapNode } from "./astToTiptap";

import { canonicalImageSrc } from "./imageDisplay";

import {

  DEFAULT_IMAGE_LAYOUT,

  DEFAULT_IMAGE_WIDTH,

  isDefaultFigureLayout,

  isImageLayout,

  mystFromLayout,

  parseWidthPercent,

  type ImageLayout

} from "./imageModel";



function wrapMark(inner: GenericNode, mark: NonNullable<TiptapNode["marks"]>[number]): GenericNode {
  if (mark.type === "bold") return { type: "strong", children: [inner] };
  if (mark.type === "italic") return { type: "emphasis", children: [inner] };
  if (mark.type === "strike") return { type: "delete", children: [inner] };
  if (mark.type === "underline") return { type: "underline", children: [inner] };
  if (mark.type === "subscript") return { type: "subscript", children: [inner] };
  if (mark.type === "superscript") return { type: "superscript", children: [inner] };
  if (mark.type === "abbreviation") {
    return { type: "abbreviation", title: mark.attrs?.title, children: [inner] };
  }
  return inner;
}

function unwrapMarks(node: TiptapNode): GenericNode[] {
  if (node.type !== "text") return astInline(node);
  const marks = node.marks ?? [];
  const hasCode = marks.some((mark) => mark.type === "code");
  let inner: GenericNode = hasCode
    ? { type: "inlineCode", value: node.text ?? "" }
    : { type: "text", value: node.text ?? "" };
  const link = marks.find((mark) => mark.type === "link");
  const wiki = marks.find((mark) => mark.type === "wikiLink");
  if (wiki) {
    const target = String(wiki.attrs?.target ?? node.text ?? "");
    const section = wiki.attrs?.section ? String(wiki.attrs.section) : undefined;
    inner = {
      type: "link",
      url: encodeWikiHref({ target, section, raw: "" }),
      children: [inner]
    };
  } else if (link) {
    inner = { type: "link", url: link.attrs?.href, children: [inner] };
  }
  for (const mark of marks) {
    if (mark.type === "code" || mark.type === "link" || mark.type === "wikiLink") continue;
    inner = wrapMark(inner, mark);
  }
  return [inner];
}



function astInline(node: TiptapNode): GenericNode[] {

  if (node.type === "text") return unwrapMarks(node);

  if (node.type === "hardBreak") return [{ type: "break" }];

  if (node.type === "inlineMath") {

    return [{ type: "inlineMath", value: String(node.attrs?.latex ?? "") }];

  }

  if (node.type === "citeChip") {

    const key = String(node.attrs?.key ?? "");

    return [{ type: "mystRole", name: "cite", value: key, children: [{ type: "cite", label: key, identifier: key }] }];

  }

  if (node.type === "crossRefChip") {

    const label = String(node.attrs?.label ?? "");

    const kind = String(node.attrs?.kind ?? "ref");

    return [

      {

        type: "crossReference",

        kind,

        label,

        identifier: label,

        children: [{ type: "text", value: String(node.attrs?.display ?? label) }]

      }

    ];

  }

  if (node.type === "footnoteRef") {

    const identifier = String(node.attrs?.identifier ?? "");

    return [{ type: "footnoteReference", identifier, label: identifier }];

  }

  if (node.type === "image") {

    return [{ type: "image", url: node.attrs?.src, alt: node.attrs?.alt }];

  }

  return (node.content ?? []).flatMap(astInline);

}



function figureToAst(node: TiptapNode, inTable: boolean): GenericNode {

  const src = canonicalImageSrc(

    String(node.attrs?.src ?? node.content?.find((c) => c.type === "image")?.attrs?.src ?? "")

  );

  const alt = String(

    node.attrs?.caption ||

      node.attrs?.alt ||

      node.content?.find((c) => c.type === "image")?.attrs?.alt ||

      ""

  ).trim();

  const width = parseWidthPercent(node.attrs?.width ?? DEFAULT_IMAGE_WIDTH);

  const layout: ImageLayout = isImageLayout(node.attrs?.layout) ? node.attrs.layout : DEFAULT_IMAGE_LAYOUT;

  if (inTable) {

    const myst = mystFromLayout(layout.startsWith("float") ? "block-center" : layout);

    const attrs = formatImageAttrList({

      width: width !== DEFAULT_IMAGE_WIDTH ? `${width}%` : undefined,

      align: myst.align

    });

    return {

      type: "image",

      url: src,

      alt,

      ...(attrs ? { title: attrs.slice(1, -1) } : {})

    };

  }

  const label = node.attrs?.label != null && String(node.attrs.label) ? String(node.attrs.label) : undefined;

  const myst = mystFromLayout(layout);

  const embedded = src.startsWith("data:image/") || src.startsWith("blob:");

  const simple = isDefaultFigureLayout(width, layout) && !label;



  if (simple) {

    return { type: "image", url: src, alt };

  }



  const image: GenericNode = { type: "image", url: src, alt };

  if (width !== DEFAULT_IMAGE_WIDTH) image.width = `${width}%`;

  if (myst.align !== "center") image.align = myst.align;

  if (myst.className) image.class = myst.className;



  if (!label && (embedded || !alt)) return image;



  const children: GenericNode[] = [image];

  if (!embedded && alt) children.push({ type: "caption", children: [{ type: "text", value: alt }] });

  const container: GenericNode = { type: "container", kind: "figure", children };

  if (label) container.label = label;

  return container;

}



function tableMetaFromAttrs(attrs: Record<string, unknown> | undefined): TableMeta {

  let widths: TableMeta["widths"] = null;

  if (attrs?.widths) {

    try {

      const parsed = JSON.parse(String(attrs.widths));

      widths = parsed;

    } catch {

      widths = String(attrs.widths) === "auto" ? "auto" : null;

    }

  }

  return {

    align: (attrs?.align as TableMeta["align"]) ?? null,

    widths,

    width: attrs?.tableWidth != null ? String(attrs.tableWidth) : null,

    caption: attrs?.caption != null ? String(attrs.caption) : null,

    label: attrs?.label != null ? String(attrs.label) : null,

    headerRows: Number(attrs?.headerRows ?? 1),

    sourceKind: (attrs?.sourceKind as TableMeta["sourceKind"]) ?? "gfm"

  };

}



function colwidthsFromTiptapTable(node: TiptapNode): number[] | null {
  const firstRow = node.content?.[0];
  if (!firstRow?.content?.length) return null;
  const widths = firstRow.content.map((cell) => {
    const colwidth = cell.attrs?.colwidth as number[] | null | undefined;
    return Array.isArray(colwidth) && colwidth[0] ? colwidth[0] : null;
  });
  const defined = widths.filter((value): value is number => value != null);
  if (!defined.length) return null;
  const fallback = defined.reduce((sum, value) => sum + value, 0) / defined.length;
  return widths.map((value) => Math.max(1, Math.round(value ?? fallback)));
}

function richTableSourceKind(meta: TableMeta): TableMeta["sourceKind"] {
  if (meta.sourceKind && meta.sourceKind !== "gfm") return meta.sourceKind;
  if (meta.caption || meta.label || meta.align || meta.width || (meta.widths && meta.widths !== "auto")) {
    return "table";
  }
  return meta.sourceKind ?? "gfm";
}

function astTableBlock(node: TiptapNode): GenericNode {
  const headerRows = Number(node.attrs?.headerRows ?? 1);
  const table: GenericNode = {
    type: "table",
    children: (node.content ?? []).map((row, rowIndex) => ({
      type: "tableRow",
      children: (row.content ?? []).map((cell) => ({
        type: "tableCell",
        header: cell.type === "tableHeader" || rowIndex < headerRows,
        align: cell.attrs?.align ?? undefined,
        children: (cell.content ?? []).map((child) => astBlock(child, true))
      }))
    }))
  };
  let meta = tableMetaFromAttrs(node.attrs);
  const colwidths = colwidthsFromTiptapTable(node);
  if (colwidths?.length) {
    meta = {
      ...meta,
      widths: colwidths,
      sourceKind: richTableSourceKind({ ...meta, widths: colwidths })
    };
  } else {
    meta = { ...meta, sourceKind: richTableSourceKind(meta) };
  }
  return withTableMeta(table, meta);
}



function astBlock(node: TiptapNode, inTable = false): GenericNode {

  switch (node.type) {

    case "paragraph":

      return { type: "paragraph", children: (node.content ?? []).flatMap(astInline) };

    case "heading":

      return {

        type: "heading",

        depth: Number(node.attrs?.level ?? 1),

        ...(node.attrs?.label ? { label: String(node.attrs.label) } : {}),

        children: (node.content ?? []).flatMap(astInline)

      };

    case "blockquote":

      return { type: "blockquote", children: (node.content ?? []).map((child) => astBlock(child)) };

    case "bulletList":

      return {

        type: "list",

        ordered: false,

        children: (node.content ?? []).map((item) => ({

          type: "listItem",

          children: (item.content ?? []).map((child) => astBlock(child))

        }))

      };

    case "orderedList":

      return {

        type: "list",

        ordered: true,

        children: (node.content ?? []).map((item) => ({

          type: "listItem",

          children: (item.content ?? []).map((child) => astBlock(child))

        }))

      };

    case "taskList":

      return {

        type: "list",

        ordered: false,

        children: (node.content ?? []).map((item) => ({

          type: "listItem",

          checked: Boolean(item.attrs?.checked),

          children: (item.content ?? []).map((child) => astBlock(child))

        }))

      };

    case "codeBlock":

      return {

        type: "code",

        lang: node.attrs?.language ?? undefined,

        showLineNumbers: Boolean(node.attrs?.showLineNumbers),

        startingLineNumber: Number(node.attrs?.startingLineNumber ?? 1),

        value: (node.content ?? []).map((n) => n.text ?? "").join("")

      };

    case "mathBlock":

      return {

        type: "math",

        value: String(node.attrs?.latex ?? ""),

        ...(node.attrs?.label ? { label: String(node.attrs.label) } : {}),

        enumerated: node.attrs?.enumerated !== false

      };

    case "mermaid":

      return {

        type: "code",

        lang: "mermaid",

        value: String(node.attrs?.source ?? "")

      };

    case "horizontalRule":

      return { type: "thematicBreak" };

    case "table":

      return astTableBlock(node);

    case "callout": {

      const kind = String(node.attrs?.kind ?? "note");

      const title = node.attrs?.title ? String(node.attrs.title) : undefined;

      const children: GenericNode[] = [];

      if (title) {

        children.push({ type: "admonitionTitle", children: [{ type: "text", value: title }] });

      }

      children.push(...(node.content ?? []).map((child) => astBlock(child)));

      return {

        type: "admonition",

        kind,

        children

      };

    }

    case "pageBreak":

      return { type: "mystDirective", name: "page-break" };

    case "image":

      return figureToAst(

        {

          type: "figure",

          attrs: {

            src: node.attrs?.src,

            alt: node.attrs?.alt,

            width: node.attrs?.width ?? DEFAULT_IMAGE_WIDTH,

            layout: node.attrs?.layout ?? DEFAULT_IMAGE_LAYOUT

          }

        },

        inTable

      );

    case "figure":

      return figureToAst(node, inTable);

    case "mystRaw": {

      const name = String(node.attrs?.name ?? "unknown");

      if (name === "blockBreak") return { type: "blockBreak" };

      return {

        type: "mystDirective",

        name,

        value: String(node.attrs?.source ?? ""),

        options: (node.attrs?.options as Record<string, unknown> | undefined) ?? undefined

      };

    }

    default:

      return { type: "paragraph", children: (node.content ?? []).flatMap(astInline) };

  }

}



export function tiptapToAst(doc: TiptapNode): GenericNode {

  return { type: "root", children: (doc.content ?? []).map((child) => astBlock(child)) };

}



export { getTableMeta, tableMetaFromAttrs };


