import type { GenericNode } from "@mdword/shared";
import { encodeWikiHref, formatImageAttrList } from "@mdword/shared";
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

function unwrapMarks(node: TiptapNode): GenericNode[] {
  if (node.type === "text") {
    let inner: GenericNode = { type: "text", value: node.text ?? "" };
    const marks = [...(node.marks ?? [])].reverse();
    for (const mark of marks) {
      if (mark.type === "bold") inner = { type: "strong", children: [inner] };
      else if (mark.type === "italic") inner = { type: "emphasis", children: [inner] };
      else if (mark.type === "strike") inner = { type: "delete", children: [inner] };
      else if (mark.type === "code") inner = { type: "inlineCode", value: node.text ?? "" };
      else if (mark.type === "link") {
        inner = { type: "link", url: mark.attrs?.href, children: [inner] };
      }
    }
    return [inner];
  }
  return astInline(node);
}

function astInline(node: TiptapNode): GenericNode[] {
  if (node.type === "text") return unwrapMarks(node);
  if (node.type === "hardBreak") return [{ type: "break" }];
  if (node.type === "image") {
    return [{ type: "image", url: node.attrs?.src, alt: node.attrs?.alt }];
  }
  if (node.type === "wikiLink") {
    const target = String(node.attrs?.target ?? "");
    const section = node.attrs?.section ? String(node.attrs.section) : undefined;
    const label = String(node.attrs?.label ?? target);
    return [
      {
        type: "link",
        url: encodeWikiHref({ target, section, raw: "" }),
        children: [{ type: "text", value: label }]
      }
    ];
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

function astBlock(node: TiptapNode, inTable = false): GenericNode {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", children: (node.content ?? []).flatMap(astInline) };
    case "heading":
      return {
        type: "heading",
        depth: Number(node.attrs?.level ?? 1),
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
        value: (node.content ?? []).map((n) => n.text ?? "").join("")
      };
    case "horizontalRule":
      return { type: "thematicBreak" };
    case "table":
      return {
        type: "table",
        children: (node.content ?? []).map((row, i) => ({
          type: "tableRow",
          children: (row.content ?? []).map((cell) => ({
            type: "tableCell",
            header: cell.type === "tableHeader" || i === 0,
            children: (cell.content ?? []).map((child) => astBlock(child, true))
          }))
        }))
      };
    case "callout":
      return {
        type: "mystDirective",
        name: String(node.attrs?.kind ?? "note"),
        children: (node.content ?? []).map((child) => astBlock(child))
      };
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
    case "mystRaw":
      return {
        type: "mystDirective",
        name: String(node.attrs?.name ?? "unknown"),
        value: String(node.attrs?.source ?? "")
      };
    default:
      return { type: "paragraph", children: (node.content ?? []).flatMap(astInline) };
  }
}

export function tiptapToAst(doc: TiptapNode): GenericNode {
  return { type: "root", children: (doc.content ?? []).map((child) => astBlock(child)) };
}
