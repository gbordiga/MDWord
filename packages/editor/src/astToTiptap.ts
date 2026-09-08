import type { GenericNode } from "@mdword/shared";
import { decodeWikiHref, WIKI_SCHEME } from "@mdword/shared";
import { sanitizeTiptapDoc } from "./sanitize";
import {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  layoutFromMyst,
  parseHtmlImg,
  parseWidthPercent,
  type ImageLayout
} from "./imageModel";

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function textNode(text: string, marks?: TiptapNode["marks"]): TiptapNode {
  return { type: "text", text, marks };
}

function withMarks(nodes: TiptapNode[], mark: { type: string; attrs?: Record<string, unknown> }): TiptapNode[] {
  return nodes.map((n) => {
    if (n.type === "text") {
      return { ...n, marks: [...(n.marks ?? []), mark] };
    }
    if (n.content) {
      return { ...n, content: withMarks(n.content, mark) };
    }
    return n;
  });
}

const EMPTY_PARAGRAPH: TiptapNode = { type: "paragraph" };

function inline(nodes: GenericNode[] | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    switch (node.type) {
      case "text": {
        const value = String(node.value ?? "");
        if (value) out.push(textNode(value));
        break;
      }
      case "strong":
        out.push(...withMarks(inline(node.children), { type: "bold" }));
        break;
      case "emphasis":
        out.push(...withMarks(inline(node.children), { type: "italic" }));
        break;
      case "delete":
      case "strikethrough":
        out.push(...withMarks(inline(node.children), { type: "strike" }));
        break;
      case "inlineCode": {
        const value = String(node.value ?? "");
        if (value) out.push(textNode(value, [{ type: "code" }]));
        break;
      }
      case "break":
        out.push({ type: "hardBreak" });
        break;
      case "image":
        break;
      case "link": {
        const url = String(node.url ?? "");
        if (url.startsWith(WIKI_SCHEME)) {
          const wiki = decodeWikiHref(url);
          const target = String(wiki?.target ?? "").replace(/\\+$/g, "").trim();
          const label = inline(node.children)
            .map((n) => n.text)
            .filter(Boolean)
            .join("");
          if (!target && !label) break;
          out.push({
            type: "wikiLink",
            attrs: {
              target: target || label,
              section: wiki?.section ?? null,
              label: label || target
            }
          });
        } else {
          out.push(...withMarks(inline(node.children), { type: "link", attrs: { href: url } }));
        }
        break;
      }
      default:
        if (node.children) out.push(...inline(node.children));
        else if (node.value) out.push(textNode(String(node.value)));
    }
  }
  return out;
}

function findImageNode(node: GenericNode | undefined): GenericNode | undefined {
  if (!node) return undefined;
  if (node.type === "image") return node;
  for (const child of node.children ?? []) {
    const found = findImageNode(child);
    if (found) return found;
  }
  return undefined;
}

function captionFromNodes(nodes: GenericNode[] | undefined): TiptapNode | null {
  const parts: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "image") continue;
    if (node.type === "container") {
      const nested = captionFromNodes(node.children);
      if (nested?.content) parts.push(...nested.content);
      continue;
    }
    if (node.type === "paragraph" || node.type === "caption") {
      parts.push(...inline(node.children));
    } else if (node.type === "text" && node.value) {
      parts.push(textNode(String(node.value)));
    } else if (node.children) {
      const nested = captionFromNodes(node.children);
      if (nested?.content) parts.push(...nested.content);
    }
  }
  const content = parts.filter((p) => p.type !== "text" || p.text);
  if (!content.length) return null;
  return { type: "caption", content };
}

function figureAttrsFromImage(
  image: GenericNode | undefined,
  extra?: { url?: unknown; alt?: unknown; width?: unknown; align?: unknown; className?: unknown; label?: unknown }
): TiptapNode["attrs"] {
  const src = String(image?.url ?? extra?.url ?? "").trim();
  const width = parseWidthPercent(image?.width ?? extra?.width);
  const layout: ImageLayout = layoutFromMyst(image?.align ?? extra?.align, image?.class ?? extra?.className);
  return {
    src,
    alt: String(image?.alt ?? extra?.alt ?? ""),
    width: width || DEFAULT_IMAGE_WIDTH,
    layout,
    label: extra?.label != null && String(extra.label) ? String(extra.label) : null
  };
}

function figureNode(attrs: TiptapNode["attrs"], caption?: TiptapNode | null): TiptapNode {
  return {
    type: "figure",
    attrs: {
      src: String(attrs?.src ?? ""),
      alt: String(attrs?.alt ?? ""),
      width: attrs?.width ?? DEFAULT_IMAGE_WIDTH,
      layout: attrs?.layout ?? DEFAULT_IMAGE_LAYOUT,
      label: attrs?.label ?? null
    },
    content: caption ? [caption] : []
  };
}

function figureFromImage(node: GenericNode, extra?: Parameters<typeof figureAttrsFromImage>[1]): TiptapNode | null {
  const attrs = figureAttrsFromImage(node.type === "image" ? node : findImageNode(node), extra);
  if (!String(attrs?.src ?? "").trim()) return null;
  return figureNode(attrs);
}

function figureFromDirective(node: GenericNode): TiptapNode {
  const options = (node.options ?? {}) as Record<string, unknown>;
  const image = findImageNode(node);
  const caption =
    captionFromNodes(node.children) ||
    (typeof node.value === "string" && node.value.trim()
      ? { type: "caption", content: [textNode(node.value.trim())] }
      : null);
  const built = figureFromImage(image ?? { type: "image", url: node.args, alt: options.alt }, {
    url: node.args,
    alt: options.alt,
    width: options.width ?? image?.width,
    align: options.align ?? image?.align,
    className: options.class ?? image?.class,
    label: options.label ?? node.label
  });
  if (!built) return EMPTY_PARAGRAPH;
  return figureNode(built.attrs, caption);
}

function paragraphBlocks(node: GenericNode): TiptapNode[] {
  const children = node.children ?? [];
  if (!children.some((c) => c.type === "image")) {
    return [{ type: "paragraph", content: inline(children) }];
  }
  const out: TiptapNode[] = [];
  let buffer: GenericNode[] = [];
  const flush = () => {
    const content = inline(buffer);
    if (content.length) out.push({ type: "paragraph", content });
    buffer = [];
  };
  for (const child of children) {
    if (child.type === "image") {
      flush();
      const fig = figureFromImage(child);
      if (fig) out.push(fig);
    } else {
      buffer.push(child);
    }
  }
  flush();
  return out.length ? out : [EMPTY_PARAGRAPH];
}

function block(node: GenericNode): TiptapNode | TiptapNode[] {
  switch (node.type) {
    case "paragraph":
      return paragraphBlocks(node);
    case "heading":
      return {
        type: "heading",
        attrs: { level: Number(node.depth ?? 1) },
        content: inline(node.children)
      };
    case "blockquote":
      return { type: "blockquote", content: blocks(node.children) };
    case "list": {
      const ordered = Boolean(node.ordered);
      const tasks = node.children?.some((c) => c.checked !== undefined);
      return {
        type: tasks ? "taskList" : ordered ? "orderedList" : "bulletList",
        content: (node.children ?? []).map((item) => ({
          type: tasks ? "taskItem" : "listItem",
          attrs: tasks ? { checked: Boolean(item.checked) } : undefined,
          content: blocks(item.children)
        }))
      };
    }
    case "code":
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: node.lang ?? null },
        content: node.value ? [textNode(String(node.value))] : []
      };
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "table":
      return {
        type: "table",
        content: (node.children ?? []).map((row, rowIndex) => ({
          type: "tableRow",
          content: (row.children ?? []).map((cell) => ({
            type: rowIndex === 0 || cell.header ? "tableHeader" : "tableCell",
            content: cell.children?.length ? blocks(cell.children) : [EMPTY_PARAGRAPH]
          }))
        }))
      };
    case "admonition":
      return {
        type: "callout",
        attrs: { kind: node.kind ?? "note" },
        content: blocks(node.children)
      };
    case "mystDirective": {
      const name = String(node.name ?? "");
      if (name === "page-break") return { type: "pageBreak" };
      const callouts = ["note", "tip", "warning", "important", "caution", "danger", "error", "hint"];
      if (callouts.includes(name)) {
        return {
          type: "callout",
          attrs: { kind: name },
          content: blocks(node.children).length
            ? blocks(node.children)
            : node.value
              ? [{ type: "paragraph", content: [textNode(String(node.value))] }]
              : [EMPTY_PARAGRAPH]
        };
      }
      if (name === "figure" || name === "image") {
        return figureFromDirective(node);
      }
      return {
        type: "mystRaw",
        attrs: {
          name,
          source: node.value ?? `::: {${name}}\n${node.value ?? ""}\n:::`
        }
      };
    }
    case "image":
      return figureFromImage(node) ?? EMPTY_PARAGRAPH;
    case "container":
      if (node.kind === "figure") return figureFromDirective(node);
      return node.children ? blocks(node.children) : EMPTY_PARAGRAPH;
    case "html": {
      const img = parseHtmlImg(String(node.value ?? ""));
      if (!img) {
        if (node.children) return blocks(node.children);
        return EMPTY_PARAGRAPH;
      }
      return figureNode({
        src: img.src,
        alt: img.alt,
        width: img.width,
        layout: img.layout,
        label: null
      });
    }
    default:
      if (node.children) return blocks(node.children);
      if (node.value) return { type: "paragraph", content: [textNode(String(node.value))] };
      return EMPTY_PARAGRAPH;
  }
}

function blocks(nodes: GenericNode[] | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    const rendered = block(node);
    if (Array.isArray(rendered)) out.push(...rendered);
    else out.push(rendered);
  }
  return out.length ? out : [EMPTY_PARAGRAPH];
}

export function astToTiptap(ast: GenericNode): TiptapNode {
  try {
    return sanitizeTiptapDoc({ type: "doc", content: blocks(ast.children) });
  } catch {
    return { type: "doc", content: [EMPTY_PARAGRAPH] };
  }
}
