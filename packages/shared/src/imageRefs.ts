import { findDataUrlRanges } from "./dataUrl";
import { formatImageAttrList, isImageAttrTitle, parseImageAttrList } from "./imageAttrs";
import type { GenericNode } from "./constants";

const ID_PREFIX = "img-";

/** MyST keeps `![alt][id]` as `imageReference` until we resolve the definition. */
export function isImageLike(node: { type?: unknown } | undefined | null): boolean {
  return node?.type === "image" || node?.type === "imageReference";
}

export function imageNodeUrl(node: GenericNode | undefined | null): string {
  if (!node) return "";
  return String(node.url ?? node.urlSource ?? node.src ?? "").trim();
}

export function normalizeDataUrl(url: string): string {
  const value = url.trim();
  if (value.startsWith("blob:")) return value;
  if (!value.startsWith("data:image/")) return value;
  const comma = value.indexOf(",");
  if (comma < 0) return value.replace(/\s+/g, "");
  return `${value.slice(0, comma + 1)}${value.slice(comma + 1).replace(/\s+/g, "")}`;
}

export function isEmbeddedImageUrl(url: string): boolean {
  const value = url.trim();
  return value.startsWith("data:image/") || value.startsWith("blob:");
}

function fnv1aHex(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Content-addressed CommonMark label: stable across save/restore. */
export function imageRefId(dataUrl: string): string {
  const normalized = normalizeDataUrl(dataUrl);
  return `${ID_PREFIX}${fnv1aHex(normalized)}${normalized.length.toString(16)}`;
}

export function imageReference(alt: string, dataUrl: string): { id: string; image: string; definition: string } {
  const id = imageRefId(dataUrl);
  return {
    id,
    image: `![${alt}][${id}]`,
    definition: `[${id}]: ${normalizeDataUrl(dataUrl)}`
  };
}

function parseDefinitionLine(line: string): { id: string; url: string } | null {
  if (!line.startsWith("[")) return null;
  const close = line.indexOf("]:");
  if (close < 1) return null;
  const id = line.slice(1, close).trim();
  if (!id) return null;
  let dest = line.slice(close + 2).trim();
  if (dest.startsWith("<")) {
    const end = dest.indexOf(">");
    if (end < 0) return null;
    const url = dest.slice(1, end).trim();
    if (!url.startsWith("data:image/")) return null;
    return { id, url: normalizeDataUrl(url) };
  }
  const url = dest.match(/^(data:image\/[^\s]+)/)?.[1];
  if (!url) return null;
  return { id, url: normalizeDataUrl(url) };
}

export function splitBodyAndDataDefs(md: string): { body: string; assets: Record<string, string> } {
  const assets: Record<string, string> = {};
  const lines = md.split("\n");
  const body: string[] = [];
  for (const line of lines) {
    const def = parseDefinitionLine(line);
    if (def) {
      assets[def.id] = def.url;
      continue;
    }
    body.push(line);
  }
  return { body: body.join("\n"), assets };
}

function skipDestinationClose(md: string, urlTo: number): number | null {
  let index = urlTo;
  if (md[index] === ">") index += 1;
  while (md[index] === " " || md[index] === "\t") index += 1;
  const quote = md[index];
  if (quote === '"' || quote === "'" || quote === "(") {
    const close = quote === "(" ? ")" : quote;
    const end = md.indexOf(close, index + 1);
    if (end < 0) return null;
    index = end + 1;
    while (md[index] === " " || md[index] === "\t") index += 1;
  }
  if (md[index] !== ")") return null;
  return index + 1;
}

function destinationTitle(md: string, urlTo: number, close: number): string {
  let index = urlTo;
  if (md[index] === ">") index += 1;
  while (md[index] === " " || md[index] === "\t") index += 1;
  const quote = md[index];
  if (quote !== '"' && quote !== "'" && quote !== "(") return "";
  const endQuote = quote === "(" ? ")" : quote;
  const end = md.indexOf(endQuote, index + 1);
  if (end < 0 || end >= close) return "";
  return md.slice(index + 1, end);
}

function skipAttrList(md: string, from: number): number {
  let index = from;
  while (md[index] === " " || md[index] === "\t") index += 1;
  if (md[index] !== "{") return from;
  const end = md.indexOf("}", index + 1);
  if (end < 0) return from;
  return parseImageAttrList(md.slice(index, end + 1)) ? end + 1 : from;
}

function attrListAfterImage(md: string, urlTo: number, close: number): { to: number; attrs: string } {
  const fromCurly = skipAttrList(md, close);
  const curly = md.slice(close, fromCurly).trim();
  if (curly) return { to: fromCurly, attrs: curly };
  const title = destinationTitle(md, urlTo, close);
  return { to: close, attrs: isImageAttrTitle(title) ? formatImageAttrList(parseImageAttrList(title) ?? {}) : "" };
}

function imageMarkupAt(
  md: string,
  urlFrom: number,
  urlTo: number
): { from: number; to: number; alt: string; attrs: string } | null {
  let destStart = urlFrom;
  if (md[destStart - 1] === "<") destStart -= 1;
  if (md[destStart - 1] !== "(" || md[destStart - 2] !== "]") return null;
  const altClose = destStart - 2;
  const open = md.lastIndexOf("![", altClose);
  if (open < 0) return null;
  const alt = md.slice(open + 2, altClose);
  if (alt.includes("\n")) return null;
  const close = skipDestinationClose(md, urlTo);
  if (close == null) return null;
  const tail = attrListAfterImage(md, urlTo, close);
  return { from: open, to: tail.to, alt, attrs: tail.attrs };
}

class ImageRefTable {
  private readonly urlToId = new Map<string, string>();
  private readonly idToUrl = new Map<string, string>();
  private readonly used = new Set<string>();

  idFor(url: string): string {
    const normalized = normalizeDataUrl(url);
    const hit = this.urlToId.get(normalized);
    if (hit) return hit;
    let id = imageRefId(normalized);
    let suffix = 2;
    while (this.idToUrl.has(id) && this.idToUrl.get(id) !== normalized) {
      id = `${imageRefId(normalized)}-${suffix}`;
      suffix += 1;
    }
    this.urlToId.set(normalized, id);
    this.idToUrl.set(id, normalized);
    return id;
  }

  mark(id: string): void {
    this.used.add(id);
  }

  definitions(): string[] {
    return [...this.used]
      .filter((id) => this.idToUrl.has(id))
      .sort()
      .map((id) => `[${id}]: ${this.idToUrl.get(id) ?? ""}`);
  }
}

function rewriteShortcutRefs(body: string, assets: Record<string, string>, table: ImageRefTable): string {
  if (!Object.keys(assets).length) return body;
  return body.replace(/!\[([^\]]*)\]\[([^\]]+)\]/g, (all, alt: string, label: string) => {
    const url = assets[label] ?? assets[label.toLowerCase()];
    if (!url) return all;
    const id = table.idFor(url);
    table.mark(id);
    return `![${alt}][${id}]`;
  });
}

function rewriteInlineDataImages(body: string, table: ImageRefTable): string {
  const ranges = findDataUrlRanges(body, 1);
  if (!ranges.length) return body;
  let out = "";
  let last = 0;
  for (const range of ranges) {
    const markup = imageMarkupAt(body, range.from, range.to);
    if (!markup) continue;
    const id = table.idFor(body.slice(range.from, range.to));
    table.mark(id);
    out += body.slice(last, markup.from);
    out += `![${markup.alt}][${id}]${markup.attrs}`;
    last = markup.to;
  }
  return out + body.slice(last);
}

function appendDefinitions(body: string, definitions: string[]): string {
  const trimmed = body.replace(/\s+$/, "");
  if (!definitions.length) return trimmed ? `${trimmed}\n` : "";
  return `${trimmed}\n\n${definitions.join("\n")}\n`;
}

/**
 * Canonical file form for embedded photos: CommonMark reference images.
 * Caption is the image alternative text: `![caption][img-…]`.
 */
/** `![alt](url "width=40%")` → `![alt](url){width=40%}` so MyST keeps the size as sibling text we can parse. */
export function rewriteImageTitlesToAttrLists(md: string): string {
  return md.replace(
    /!\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(?:\s+(["'])([^"']*)\3)?\)(\s*\{[^}]*\})?/g,
    (all, alt: string, dest: string, _quote: string, title: string, curly: string) => {
      if (curly && parseImageAttrList(curly)) return `![${alt}](${dest})${String(curly).trim()}`;
      if (title && isImageAttrTitle(title)) {
        return `![${alt}](${dest})${formatImageAttrList(parseImageAttrList(title) ?? {})}`;
      }
      return all;
    }
  );
}

export function rewriteEmbeddedImagesToReferences(md: string): string {
  const { body, assets } = splitBodyAndDataDefs(md);
  const table = new ImageRefTable();
  for (const url of Object.values(assets)) table.idFor(url);
  const next = rewriteInlineDataImages(rewriteShortcutRefs(body, assets, table), table);
  return rewriteImageTitlesToAttrLists(appendDefinitions(next, table.definitions()));
}

function refKey(node: GenericNode): string {
  return String(node.identifier ?? node.label ?? "")
    .trim()
    .toLowerCase();
}

function walkImageRefs(node: GenericNode, visit: (current: GenericNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walkImageRefs(child, visit);
}

/**
 * myst-to-md crashes on `:::figure` whose only child is an `imageReference`
 * (`node.source.label` when no `image` exists). Resolve refs to concrete images
 * so visual load and source serialize see the same tree.
 */
export function resolveImageReferences(node: GenericNode): GenericNode {
  const wanted = new Set<string>();
  walkImageRefs(node, (current) => {
    if (current.type === "imageReference") {
      const id = refKey(current);
      if (id) wanted.add(id);
    }
  });
  const defs = new Map<string, string>();
  walkImageRefs(node, (current) => {
    if (current.type !== "definition") return;
    const id = refKey(current);
    const url = String(current.url ?? current.urlSource ?? "");
    if (id && url && (wanted.has(id) || isEmbeddedImageUrl(url))) defs.set(id, url);
  });
  if (!defs.size) return node;
  const rewrite = (current: GenericNode): GenericNode => {
    if (current.type === "imageReference") {
      const url = defs.get(refKey(current));
      if (!url) return current;
      return {
        type: "image",
        url,
        alt: String(current.alt ?? ""),
        ...(current.title != null ? { title: current.title } : {})
      };
    }
    if (!current.children) return current;
    const children = current.children
      .map(rewrite)
      .filter((child) => child.type !== "definition" || !defs.has(refKey(child)));
    return { ...current, children };
  };
  return rewrite(node);
}
