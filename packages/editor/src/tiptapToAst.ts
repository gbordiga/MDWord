import type { GenericNode } from "@mdword/shared";
import { encodeWikiHref } from "@mdword/shared";
import type { TiptapNode } from "./astToTiptap";

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

function astBlock(node: TiptapNode): GenericNode {
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
      return { type: "blockquote", children: (node.content ?? []).map(astBlock) };
    case "bulletList":
      return {
        type: "list",
        ordered: false,
        children: (node.content ?? []).map((item) => ({
          type: "listItem",
          children: (item.content ?? []).map(astBlock)
        }))
      };
    case "orderedList":
      return {
        type: "list",
        ordered: true,
        children: (node.content ?? []).map((item) => ({
          type: "listItem",
          children: (item.content ?? []).map(astBlock)
        }))
      };
    case "taskList":
      return {
        type: "list",
        ordered: false,
        children: (node.content ?? []).map((item) => ({
          type: "listItem",
          checked: Boolean(item.attrs?.checked),
          children: (item.content ?? []).map(astBlock)
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
            children: (cell.content ?? []).map(astBlock)
          }))
        }))
      };
    case "callout":
      return {
        type: "mystDirective",
        name: String(node.attrs?.kind ?? "note"),
        children: (node.content ?? []).map(astBlock)
      };
    case "pageBreak":
      return { type: "mystDirective", name: "page-break" };
    case "figure": {
      const children: GenericNode[] = [];
      for (const child of node.content ?? []) {
        if (child.type === "image") {
          children.push({ type: "image", url: child.attrs?.src, alt: child.attrs?.alt });
        } else if (child.type === "caption") {
          children.push({
            type: "paragraph",
            children: (child.content ?? []).flatMap(astInline)
          });
        }
      }
      return { type: "mystDirective", name: "figure", children };
    }
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
  return { type: "root", children: (doc.content ?? []).map(astBlock) };
}
