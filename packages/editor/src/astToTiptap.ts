import type { GenericNode } from "@mdword/shared";
import {
  decodeFileUrl,
  decodeWikiHref,
  stripTrailingBackslashes,
  extractTableFromDirective,
  getTableMeta,
  imageNodeUrl,
  isImageLike,
  isMathBlockLanguage,
  isMermaidLanguage,
  isMystCalloutKind,
  mermaidSourceFromNode,
  MYST_TABLE_DIRECTIVES,
  parseImageAttrList,
  promotePipeParagraphs,
  resolveImageReferences,
  withTableMeta,
  WIKI_SCHEME,
  type TableMeta
} from "@mdword/shared";
import { sanitizeTiptapDoc } from "./sanitize";
import { colwidthsFromRatios } from "./tableCommands";
import { tiptapToAst } from "./tiptapToAst";
import { canonicalImageSrc } from "./imageDisplay";
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
          const target = stripTrailingBackslashes(String(wiki?.target ?? "")).trim();
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
      case "inlineMath":
        out.push({ type: "inlineMath", attrs: { latex: String(node.value ?? "") } });
        break;
      case "subscript":
        out.push(...withMarks(inline(node.children), { type: "subscript" }));
        break;
      case "superscript":
        out.push(...withMarks(inline(node.children), { type: "superscript" }));
        break;
      case "underline":
        out.push(...withMarks(inline(node.children), { type: "underline" }));
        break;
      case "abbreviation":
        out.push(
          ...withMarks(inline(node.children), {
            type: "abbreviation",
            attrs: { title: String(node.title ?? "") }
          })
        );
        break;
      case "crossReference":
        out.push({
          type: "crossRefChip",
          attrs: {
            label: String(node.label ?? node.identifier ?? ""),
            kind: String(node.kind ?? "ref"),
            display: "?"
          }
        });
        break;
      case "cite":
        out.push({
          type: "citeChip",
          attrs: { key: String(node.label ?? node.identifier ?? "") }
        });
        break;
      case "footnoteReference":
        out.push({
          type: "footnoteRef",
          attrs: {
            identifier: String(node.identifier ?? node.label ?? ""),
            number: "?"
          }
        });
        break;
      case "mystRole": {
        const inner = node.children?.[0];
        if (inner) out.push(...inline([inner]));
        else if (node.value) out.push(textNode(String(node.value)));
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
  if (isImageLike(node)) return node;
  for (const child of node.children ?? []) {
    const found = findImageNode(child);
    if (found) return found;
  }
  return undefined;
}

function looksLikeImageMarkup(text: string): boolean {
  const s = text.trim();
  if (!s.startsWith("![")) return false;
  const altEnd = s.indexOf("]", 2);
  if (altEnd < 0) return false;
  let p = altEnd + 1;
  if (s[p] === "(") {
    const close = s.indexOf(")", p + 1);
    if (close < 0) return false;
    p = close + 1;
  } else if (s[p] === "[") {
    const close = s.indexOf("]", p + 1);
    if (close < 0) return false;
    p = close + 1;
  } else {
    return false;
  }
  while (p < s.length && (s[p] === " " || s[p] === "\t")) p += 1;
  if (p >= s.length) return true;
  if (s[p] !== "{") return false;
  const curlyEnd = s.indexOf("}", p + 1);
  if (curlyEnd < 0) return false;
  p = curlyEnd + 1;
  while (p < s.length && (s[p] === " " || s[p] === "\t")) p += 1;
  return p >= s.length;
}

function captionFromNodes(nodes: GenericNode[] | undefined): TiptapNode | null {
  const parts: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    if (isImageLike(node)) continue;
    if (node.type === "container") {
      const nested = captionFromNodes(node.children);
      if (nested?.content) parts.push(...nested.content);
      continue;
    }
    if (node.type === "paragraph" || node.type === "caption") {
      parts.push(...inline(node.children));
    } else if (node.type === "text" && node.value && !looksLikeImageMarkup(String(node.value))) {
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

function inlineText(nodes: TiptapNode[] | undefined): string {
  return (nodes ?? []).map((node) => node.text ?? inlineText(node.content)).join("").trim();
}

function applyAttrList(image: GenericNode, raw: string): void {
  const listed = parseImageAttrList(raw);
  if (!listed) return;
  if (listed.width && image.width == null) image.width = listed.width;
  if (listed.align && image.align == null) image.align = listed.align;
  if (listed.className && image.class == null) image.class = listed.className;
}

function absorbTrailingImageAttrs(nodes: GenericNode[] | undefined): GenericNode[] {
  const list = nodes ?? [];
  const out: GenericNode[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const node = list[index] as GenericNode;
    if (isImageLike(node)) {
      applyAttrList(node, String(node.title ?? ""));
      const next = list[index + 1];
      if (next?.type === "text") {
        const raw = String(next.value ?? "").trim();
        if (parseImageAttrList(raw) && /^\{[^}]+\}$/.test(raw)) {
          applyAttrList(node, raw);
          index += 1;
        }
      }
    }
    out.push(node);
  }
  return out;
}

function figureAttrsFromImage(
  image: GenericNode | undefined,
  extra?: { url?: unknown; alt?: unknown; width?: unknown; align?: unknown; className?: unknown; label?: unknown; caption?: string }
): TiptapNode["attrs"] {
  const src = decodeFileUrl(canonicalImageSrc(imageNodeUrl(image) || String(extra?.url ?? "")));
  const listed = parseImageAttrList(String(image?.title ?? ""));
  const width = parseWidthPercent(image?.width ?? extra?.width ?? listed?.width);
  const layout: ImageLayout = layoutFromMyst(
    image?.align ?? extra?.align ?? listed?.align,
    image?.class ?? extra?.className ?? listed?.className
  );
  return {
    src,
    alt: String(image?.alt ?? extra?.alt ?? ""),
    caption: extra?.caption || String(image?.alt ?? extra?.alt ?? ""),
    width: width || DEFAULT_IMAGE_WIDTH,
    layout,
    label: extra?.label != null && String(extra.label) ? String(extra.label) : null
  };
}

function figureNode(attrs: TiptapNode["attrs"], caption?: TiptapNode | null): TiptapNode {
  const fromCaption = inlineText(caption?.content);
  const text = String(
    (fromCaption && !looksLikeImageMarkup(fromCaption) ? fromCaption : "") || attrs?.alt || attrs?.caption || ""
  ).trim();
  return {
    type: "figure",
    attrs: {
      src: canonicalImageSrc(String(attrs?.src ?? "")),
      alt: text,
      caption: text,
      width: attrs?.width ?? DEFAULT_IMAGE_WIDTH,
      layout: attrs?.layout ?? DEFAULT_IMAGE_LAYOUT,
      label: attrs?.label ?? null
    }
  };
}

function figureFromImage(node: GenericNode, extra?: Parameters<typeof figureAttrsFromImage>[1]): TiptapNode | null {
  const attrs = figureAttrsFromImage(isImageLike(node) ? node : findImageNode(node), extra);
  if (!String(attrs?.src ?? "").trim()) return null;
  return figureNode(attrs);
}

function figureFromHtmlish(node: GenericNode): TiptapNode | null {
  const raw =
    node.type === "html"
      ? String(node.value ?? "")
      : node.type === "text" && /<img\b/i.test(String(node.value ?? ""))
        ? String(node.value ?? "")
        : "";
  if (!raw) return null;
  const img = parseHtmlImg(raw);
  if (!img) return null;
  return figureNode({
    src: img.src,
    alt: img.alt,
    width: img.width,
    layout: img.layout,
    label: null
  });
}

function figureFromLooseImageText(text: string): TiptapNode | null {
  if (
    !text.includes("data:image") &&
    !text.includes("{image") &&
    !text.includes("{figure") &&
    !text.includes(":::figure") &&
    !text.includes("<img") &&
    !text.includes("![") &&
    !text.includes("blob:")
  ) {
    return null;
  }
  const raw = text
    .replace(/```/g, "\n")
    .replace(/:::/g, "\n")
    .trim();
  const html = figureFromHtmlish({ type: "html", value: raw });
  if (html) return html;
  const directive = raw.match(/(?:\{(?:image|figure)\}|(?:^|\n)\s*(?:image|figure))\s+([\s\S]+)/i);
  if (directive?.[1] && /\{(?:image|figure)\}|(?:^|\n)\s*(?:image|figure)\s+/im.test(raw)) {
    const rest = directive[1];
    const optionAt = rest.search(/\n\s*:\w+:/);
    let url = (optionAt >= 0 ? rest.slice(0, optionAt) : rest).trim();
    if (url.startsWith("data:image/") || url.startsWith("blob:")) url = url.replace(/\s+/g, "");
    else url = url.split(/\s+/)[0] ?? "";
    const alt = raw.match(/:alt:\s*(.+)/i)?.[1]?.trim() ?? "";
    if (url) {
      return figureNode({
        src: canonicalImageSrc(url),
        alt,
        width: parseWidthPercent(raw.match(/:width:\s*(.+)/i)?.[1]),
        layout: DEFAULT_IMAGE_LAYOUT,
        label: null
      });
    }
  }
  const md = raw.match(/!\[([^\]]*)\]\((<[^>\n]+>|data:image\/[^)]+|blob:[^)\s]+|[^)\n]+)\)(?:\s*\{([^}]+)\})?/);
  if (md?.[2]) {
    let src = md[2].trim();
    if (src.startsWith("<") && src.endsWith(">")) src = src.slice(1, -1).trim();
    else if (/\s/.test(src)) {
      const titled = src.match(/^(.*?)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/);
      if (titled?.[1]) src = titled[1].trim();
      else if (!raw.trim().startsWith("![")) return null;
    }
    const listed = parseImageAttrList(md[3] ? `{${md[3]}}` : "");
    return figureNode({
      src: canonicalImageSrc(src),
      alt: md[1] ?? "",
      width: parseWidthPercent(listed?.width),
      layout: listed ? layoutFromMyst(listed.align, listed.className) : DEFAULT_IMAGE_LAYOUT,
      label: null
    });
  }
  if (raw.startsWith("blob:")) {
    const src = canonicalImageSrc(raw.split(/\s/)[0] ?? raw);
    if (src.startsWith("data:image/")) {
      return figureNode({
        src,
        alt: "",
        width: DEFAULT_IMAGE_WIDTH,
        layout: DEFAULT_IMAGE_LAYOUT,
        label: null
      });
    }
  }
  return null;
}

function nodeText(node: GenericNode): string {
  const parts: string[] = [];
  if (typeof node.lang === "string") parts.push(node.lang);
  if (typeof node.meta === "string") parts.push(node.meta);
  if (typeof node.args === "string") parts.push(node.args);
  if (typeof node.value === "string") parts.push(node.value);
  for (const child of node.children ?? []) parts.push(nodeText(child));
  return parts.join("\n");
}

function isFenceContinuation(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t === "```" || t === ":::") return true;
  if (/^:\w+:/.test(t)) return true;
  return /^[A-Za-z0-9+/=\s]+$/.test(t) && t.replace(/\s/g, "").length >= 16;
}

function leftoverWithoutImage(text: string): string {
  return text
    .replace(/```/g, " ")
    .replace(/\{(?:image|figure)\}/gi, " ")
    .replace(/:::/g, " ")
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]+\])/g, " ")
    .replace(/data:image\/[^\s)]+/g, " ")
    .replace(/blob:[^\s)]+/g, " ")
    .replace(/:\s*(alt|width|align|class)\s*:[^\n]*/gi, " ")
    .replace(/\{[^}]*\b(?:width|align|class)=[^}]*\}/gi, " ")
    .replace(/^[A-Za-z0-9+/=]{16,}$/gm, " ");
}

function loneImageFrom(node: GenericNode): TiptapNode | null {
  const text = nodeText(node);
  const fig = figureFromLooseImageText(text);
  const src = String(fig?.attrs?.src ?? "");
  if (!fig || (!src.startsWith("data:image/") && !src.startsWith("blob:"))) return null;
  if (/\S/.test(leftoverWithoutImage(text))) return null;
  return fig;
}

function consumeLooseFigure(nodes: GenericNode[], start: number): { node: TiptapNode; next: number } | null {
  const first = nodes[start];
  if (!first || !["paragraph", "text", "code", "codeBlock", "html"].includes(first.type)) return null;
  let text = nodeText(first);
  if (
    !text.includes("{image") &&
    !text.includes("{figure") &&
    !text.includes(":::figure") &&
    !text.includes("```") &&
    !/image\s+data:image/i.test(text)
  ) {
    return null;
  }
  let end = start + 1;
  while (end < nodes.length && end <= start + 12) {
    const piece = nodes[end];
    if (!piece) break;
    const next = nodeText(piece);
    if (!isFenceContinuation(next) && !next.includes("data:image") && !next.includes("{image") && !next.includes("{figure") && !next.includes(":::")) {
      break;
    }
    text += `\n${next}`;
    end += 1;
    if ((text.includes("```") && text.trim().endsWith("```")) || text.trim().endsWith(":::")) break;
  }
  const fig = figureFromLooseImageText(text);
  if (!fig) return null;
  const src = String(fig.attrs?.src ?? "");
  if (!src.startsWith("data:image/") && !src.startsWith("blob:") && !src) return null;
  return { node: fig, next: Math.max(end, start + 1) };
}

function figureFromDirective(node: GenericNode): TiptapNode {
  const options = (node.options ?? {}) as Record<string, unknown>;
  const image = findImageNode(node);
  const rawValue = typeof node.value === "string" ? node.value.trim() : "";
  const caption =
    captionFromNodes(node.children) ||
    (rawValue && !looksLikeImageMarkup(rawValue) ? { type: "caption", content: [textNode(rawValue)] } : null);
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
  const children = absorbTrailingImageAttrs(node.children);
  const loose = figureFromLooseImageText(children.map((child) => String(child.value ?? "")).join("\n"));
  if (!children.some((c) => isImageLike(c) || figureFromHtmlish(c))) {
    if (loose) return [loose];
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
    if (isImageLike(child)) {
      flush();
      const fig = figureFromImage(child);
      if (fig) out.push(fig);
    } else {
      const htmlFig = figureFromHtmlish(child);
      if (htmlFig) {
        flush();
        out.push(htmlFig);
      } else {
        buffer.push(child);
      }
    }
  }
  flush();
  return out.length ? out : [EMPTY_PARAGRAPH];
}

function astTable(node: GenericNode, meta: TableMeta = getTableMeta(node)): TiptapNode {
  const headerRows = meta.headerRows ?? 1;
  const ratioWidths = Array.isArray(meta.widths) ? meta.widths : null;
  const colwidths =
    ratioWidths?.length && ratioWidths.every((value) => typeof value === "number")
      ? colwidthsFromRatios(ratioWidths, 600)
      : null;
  return {
    type: "table",
    attrs: {
      align: meta.align ?? null,
      widths: meta.widths != null ? JSON.stringify(meta.widths) : null,
      tableWidth: meta.width ?? null,
      caption: meta.caption ?? null,
      label: meta.label ?? null,
      headerRows,
      sourceKind: meta.sourceKind ?? "gfm"
    },
    content: (node.children ?? []).map((row, rowIndex) => ({
      type: "tableRow",
      content: (row.children ?? []).map((cell, colIndex) => {
        const kids = absorbTrailingImageAttrs(cell.children);
        const lone = loneImageFrom({ ...cell, children: kids });
        const isHeader = Boolean(cell.header) || rowIndex < headerRows;
        const colwidth =
          rowIndex === 0 && colwidths && colwidths[colIndex] ? [colwidths[colIndex]] : null;
        return {
          type: isHeader ? "tableHeader" : "tableCell",
          attrs: {
            align: cell.align ?? null,
            ...(colwidth ? { colwidth } : {})
          },
          content: lone ? [lone] : kids.length ? blocks(kids) : [EMPTY_PARAGRAPH]
        };
      })
    }))
  };
}

function calloutFromAdmonition(node: GenericNode, fallbackKind = "note"): TiptapNode {
  const titleNode = node.children?.find((c) => c.type === "admonitionTitle");
  const title = titleNode
    ? inline(titleNode.children)
        .map((n) => n.text ?? "")
        .join("")
        .trim()
    : null;
  const body = (node.children ?? []).filter((c) => c.type !== "admonitionTitle");
  return {
    type: "callout",
    attrs: { kind: String(node.kind ?? fallbackKind), title: title || null },
    content: blocks(body).length ? blocks(body) : [EMPTY_PARAGRAPH]
  };
}

function block(node: GenericNode): TiptapNode | TiptapNode[] {
  switch (node.type) {
    case "paragraph":
      return paragraphBlocks(node);
    case "heading":
      return {
        type: "heading",
        attrs: {
          level: Number(node.depth ?? 1),
          label: node.label ?? node.identifier ?? null
        },
        content: inline(node.children)
      };
    case "math":
      return {
        type: "mathBlock",
        attrs: {
          latex: String(node.value ?? ""),
          label: node.label ?? node.identifier ?? null,
          enumerated: node.enumerated !== false
        }
      };
    case "footnoteDefinition":
      return {
        type: "callout",
        attrs: { kind: "note", title: `Footnote ${node.label ?? node.identifier ?? ""}` },
        content: blocks(node.children)
      };
    case "blockBreak":
      return {
        type: "mystRaw",
        attrs: { name: "blockBreak", source: "+++", options: null }
      };
    case "block":
      return blocks(node.children);
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
    case "mermaid":
      return { type: "mermaid", attrs: { source: mermaidSourceFromNode(node) } };
    case "code":
    case "codeBlock": {
      if (isMermaidLanguage(node.lang)) {
        return { type: "mermaid", attrs: { source: mermaidSourceFromNode(node) } };
      }
      if (isMathBlockLanguage(node.lang)) {
        return {
          type: "mathBlock",
          attrs: {
            latex: mermaidSourceFromNode(node),
            label: null,
            enumerated: true
          }
        };
      }
      const loose = figureFromLooseImageText([node.lang, node.meta, node.value].filter(Boolean).join("\n"));
      if (loose) return loose;
      return {
        type: "codeBlock",
        attrs: {
          language: node.lang ?? null,
          showLineNumbers: Boolean(node.showLineNumbers),
          startingLineNumber: node.startingLineNumber ?? 1
        },
        content: node.value ? [textNode(String(node.value))] : []
      };
    }
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "table":
      return astTable(node);
    case "admonition":
      return calloutFromAdmonition(node);
    case "mystDirective": {
      const name = String(node.name ?? "");
      if (name === "page-break") return { type: "pageBreak" };
      if (isMystCalloutKind(name)) {
        const inner = node.children?.find((c) => c.type === "admonition");
        if (inner) return calloutFromAdmonition(inner);
        return {
          type: "callout",
          attrs: { kind: name, title: node.args ? String(node.args) : null },
          content: blocks(node.children).length
            ? blocks(node.children)
            : node.value
              ? [{ type: "paragraph", content: [textNode(String(node.value))] }]
              : [EMPTY_PARAGRAPH]
        };
      }
      if (MYST_TABLE_DIRECTIVES.has(name)) {
        const extracted = extractTableFromDirective(node);
        if (extracted.table) {
          return astTable(withTableMeta(extracted.table, extracted.meta), extracted.meta);
        }
      }
      if (name === "figure" || name === "image") {
        return figureFromDirective(node);
      }
      if (name === "mermaid") {
        return { type: "mermaid", attrs: { source: mermaidSourceFromNode(node) } };
      }
      if (name === "math" || name === "equation") {
        return {
          type: "mathBlock",
          attrs: {
            latex: String(node.value ?? mermaidSourceFromNode(node)),
            label: (node.options as Record<string, unknown> | undefined)?.label ?? null,
            enumerated: (node.options as Record<string, unknown> | undefined)?.enumerated !== false
          }
        };
      }
      if (name === "code" || name === "code-block") {
        const options = (node.options ?? {}) as Record<string, unknown>;
        return {
          type: "codeBlock",
          attrs: {
            language: String(node.args ?? options.language ?? ""),
            showLineNumbers: Boolean(options["lineno-start"] ?? options.linenos)
          },
          content: node.value ? [textNode(String(node.value))] : blocks(node.children).flatMap((b) =>
            b.type === "paragraph" ? b.content ?? [] : [textNode("")]
          )
        };
      }
      return {
        type: "mystRaw",
        attrs: {
          name,
          source: node.value ?? "",
          options: node.options ?? null
        }
      };
    }
    case "image":
    case "imageReference":
      return figureFromImage(node) ?? EMPTY_PARAGRAPH;
    case "container":
      if (node.kind === "figure") return figureFromDirective(node);
      if (node.kind === "table") {
        const table = node.children?.find((c) => c.type === "table");
        if (table) {
          const caption = node.children?.find((c) => c.type === "caption");
          const captionText = caption
            ? inline(
                (caption.children ?? []).flatMap((c) =>
                  c.type === "paragraph" ? c.children ?? [] : [c]
                )
              )
                .map((n) => n.text ?? "")
                .join("")
                .trim()
            : null;
          const stored = getTableMeta(table);
          const meta: TableMeta = {
            ...stored,
            caption: captionText || stored.caption,
            label: String(node.label ?? node.identifier ?? "") || stored.label || null,
            sourceKind: stored.sourceKind ?? "table"
          };
          return astTable(withTableMeta(table, meta), meta);
        }
      }
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
    default: {
      if (node.children) return blocks(node.children);
      if (node.value) {
        const loose = figureFromLooseImageText(String(node.value));
        if (loose) return loose;
        return { type: "paragraph", content: [textNode(String(node.value))] };
      }
      return EMPTY_PARAGRAPH;
    }
  }
}

export interface VisualOrigin {
  from: number;
  to: number;
}

function blocks(
  nodes: GenericNode[] | undefined,
  origins?: VisualOrigin[]
): TiptapNode[] {
  const list = absorbTrailingImageAttrs(nodes);
  const out: TiptapNode[] = [];
  let index = 0;
  while (index < list.length) {
    const consumed = consumeLooseFigure(list, index);
    if (consumed) {
      out.push(consumed.node);
      origins?.push({ from: index, to: consumed.next });
      index = consumed.next;
      continue;
    }
    const rendered = block(list[index] as GenericNode);
    if (Array.isArray(rendered)) {
      out.push(...rendered);
      for (let count = 0; count < rendered.length; count++) {
        origins?.push({ from: index, to: index + 1 });
      }
    } else {
      out.push(rendered);
      origins?.push({ from: index, to: index + 1 });
    }
    index += 1;
  }
  if (!out.length) {
    out.push(EMPTY_PARAGRAPH);
    origins?.push({ from: 0, to: 0 });
  }
  return out;
}

function definitionKey(node: GenericNode): string {
  return String(node.identifier ?? node.label ?? "")
    .trim()
    .toLowerCase();
}

function isResolvedAway(node: GenericNode, resolved: GenericNode[]): boolean {
  if (node.type !== "definition") return false;
  const id = definitionKey(node);
  return !resolved.some((child) => child.type === "definition" && definitionKey(child) === id);
}

function mapResolvedToParse(parseKids: GenericNode[], resolvedKids: GenericNode[]): number[] {
  const map: number[] = [];
  let parseIndex = 0;
  for (let resolvedIndex = 0; resolvedIndex < resolvedKids.length; resolvedIndex++) {
    while (parseIndex < parseKids.length && isResolvedAway(parseKids[parseIndex]!, resolvedKids)) {
      parseIndex += 1;
    }
    map[resolvedIndex] = Math.min(parseIndex, Math.max(0, parseKids.length - 1));
    parseIndex += 1;
  }
  return map;
}

function remapOrigins(origins: VisualOrigin[], resolvedToParse: number[]): VisualOrigin[] {
  return origins.map((origin) => {
    if (origin.to <= origin.from) return { from: 0, to: 0 };
    const from = resolvedToParse[origin.from] ?? origin.from;
    const last = resolvedToParse[origin.to - 1] ?? origin.to - 1;
    return { from, to: last + 1 };
  });
}

export function visualProjection(ast: GenericNode): { ast: GenericNode; origins: VisualOrigin[] } {
  try {
    const parseKids = ast.children ?? [];
    const resolved = promotePipeParagraphs(resolveImageReferences(ast));
    const resolvedKids = resolved.children ?? [];
    const rawOrigins: VisualOrigin[] = [];
    const content = blocks(resolvedKids, rawOrigins);
    const doc = sanitizeTiptapDoc({ type: "doc", content });
    const sanitized = doc.content ?? [];
    const resolvedToParse = mapResolvedToParse(parseKids, resolvedKids);
    const mapped = remapOrigins(rawOrigins, resolvedToParse);
    const origins =
      rawOrigins.length === sanitized.length ? mapped : mapped.slice(0, sanitized.length);
    return { ast: tiptapToAst(doc), origins };
  } catch {
    return { ast: { type: "root", children: [{ type: "paragraph" }] }, origins: [] };
  }
}

export function astToTiptap(ast: GenericNode): TiptapNode {
  try {
    const resolved = promotePipeParagraphs(resolveImageReferences(ast));
    return sanitizeTiptapDoc({ type: "doc", content: blocks(resolved.children) });
  } catch {
    return { type: "doc", content: [EMPTY_PARAGRAPH] };
  }
}
