import { writeMd } from "myst-to-md";
import { VFile } from "vfile";
import { dumpYaml } from "@mdword/myst-parser";
import {
  createDataUrlStubber,
  formatImageAttrList,
  imageNodeUrl,
  isImageLike,
  parseImageAttrList,
  padTableColumns,
  promotePipeParagraphs,
  resolveImageReferences,
  rewriteEmbeddedImageFences,
  rewriteEmbeddedImagesToReferences,
  rewriteMarkdownToWikiLinks,
  unescapeGfmTablePipes,
  type GenericNode
} from "@mdword/shared";
import type { Document as YamlDocument } from "yaml";

function htmlImg(value: string): { url: string; alt: string } | null {
  const start = value.toLowerCase().indexOf("<img");
  if (start < 0) return null;
  const end = value.indexOf(">", start);
  if (end < 0) return null;
  const tag = value.slice(start, end + 1);
  const src = tag.match(/\bsrc\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bsrc\s*=\s*'([^']*)'/i)?.[1];
  if (!src) return null;
  const alt = tag.match(/\balt\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\balt\s*=\s*'([^']*)'/i)?.[1] ?? "";
  return { url: src, alt };
}

function looseImageFromText(text: string): { url: string; alt: string } | null {
  const raw = text.trim().replace(/^```/, "").replace(/```$/, "").trim();
  const html = htmlImg(raw);
  if (html) return html;
  const directive = raw.match(/^(?:\{image\}|image)\s+(\S+)/i);
  if (directive?.[1]) {
    const alt = raw.match(/:alt:\s*(.+)/i)?.[1]?.trim() ?? "";
    return { url: directive[1], alt };
  }
  const md = raw.match(/!\[([^\]]*)\]\((data:image\/[^)]+|[^)\s]+)\)/);
  if (md?.[2]) return { url: md[2], alt: md[1] ?? "" };
  return null;
}

type TableImage = {
  url: string;
  alt: string;
  width?: unknown;
  align?: unknown;
  className?: unknown;
  title?: unknown;
};

function firstTableImage(node: GenericNode): TableImage | null {
  if (isImageLike(node)) {
    const url = imageNodeUrl(node) || String(node.args ?? "");
    if (url) {
      return {
        url,
        alt: String(node.alt ?? ""),
        width: node.width,
        align: node.align,
        className: node.class,
        title: node.title
      };
    }
  }
  if ((node.type === "html" || node.type === "text") && typeof node.value === "string") {
    const img = node.type === "html" ? htmlImg(node.value) : looseImageFromText(node.value);
    if (img) return img;
  }
  const name = String(node.name ?? node.kind ?? "");
  if (node.type === "mystDirective" || node.type === "container") {
    if (name === "image" || name === "figure") {
      const nested = (node.children ?? []).map(firstTableImage).find(Boolean);
      const url = String(nested?.url ?? node.args ?? node.url ?? "");
      if (url) {
        const options = (node.options ?? {}) as Record<string, unknown>;
        return {
          url,
          alt: String(nested?.alt ?? options.alt ?? node.alt ?? ""),
          width: nested?.width ?? options.width ?? node.width,
          align: nested?.align ?? options.align ?? node.align,
          className: nested?.className ?? options.class ?? node.class,
          title: nested?.title ?? node.title
        };
      }
    }
  }
  for (const child of node.children ?? []) {
    const found = firstTableImage(child);
    if (found) return found;
  }
  return null;
}

function isEmbeddedUrl(url: string): boolean {
  return url.startsWith("data:image/") || url.startsWith("blob:");
}

function simpleImage(image: TableImage): GenericNode {
  const listed = parseImageAttrList(String(image.title ?? ""));
  const attrs = formatImageAttrList({
    width: image.width != null ? String(image.width) : listed?.width,
    align: image.align != null ? String(image.align) : listed?.align,
    className: image.className != null ? String(image.className) : listed?.className
  });
  return {
    type: "image",
    url: image.url,
    alt: image.alt,
    ...(attrs ? { title: attrs.slice(1, -1) } : {})
  };
}

function applyDirectiveOptions(node: GenericNode, options: Record<string, unknown>): GenericNode {
  const next = { ...node };
  for (const [key, value] of Object.entries(options)) {
    if (value == null || value === "") continue;
    if (next[key] == null) next[key] = value;
  }
  return next;
}

/**
 * myst-parser keeps `:::{figure}` as a `mystDirective` wrapper. myst-to-md writes
 * those with backtick fences (` ```{figure} `) and drops :width: / :align:.
 * Unwrap to the inner container so restore/save keep colon fences.
 */
function unwrapFigureDirective(node: GenericNode): GenericNode {
  const name = String(node.name ?? "");
  if (node.type !== "mystDirective" || (name !== "figure" && name !== "image")) return node;
  const options = (node.options ?? {}) as Record<string, unknown>;
  const inner = (node.children ?? []).find((child) => child.type === "container" && child.kind === "figure");
  if (inner) {
    const children = (inner.children ?? []).map((child) => {
      if (isImageLike(child)) return applyDirectiveOptions(child, options);
      if (child.type === "paragraph") {
        const hasImage = (child.children ?? []).some(isImageLike);
        if (hasImage) return child;
        return { type: "caption", children: child.children ?? [] };
      }
      return child;
    });
    return applyDirectiveOptions({ ...inner, children }, options);
  }
  if (name !== "figure") return node;
  const image = (node.children ?? []).find(isImageLike);
  const url = imageNodeUrl(image) || String(node.args ?? node.url ?? "");
  if (!url) return node;
  const img = applyDirectiveOptions(
    {
      type: "image",
      url,
      alt: String(image?.alt ?? options.alt ?? ""),
      ...(image ?? {})
    },
    options
  );
  const caption = String(node.value ?? "").trim();
  const children: GenericNode[] = [img];
  if (caption) children.push({ type: "caption", children: [{ type: "text", value: caption }] });
  return applyDirectiveOptions({ type: "container", kind: "figure", children }, options);
}

function unwrapFigureDirectives(node: GenericNode): GenericNode {
  const unwrapped = unwrapFigureDirective(node);
  if (!unwrapped.children) return unwrapped;
  return { ...unwrapped, children: unwrapped.children.map(unwrapFigureDirectives) };
}

function rewriteTickFigureFences(md: string): string {
  return md.replace(/```\{figure\}([^\n]*)\n([\s\S]*?)```/gi, (_, args: string, body: string) => {
    return `:::{figure}${args}\n${String(body).replace(/\s+$/, "")}\n:::`;
  });
}

/** GFM table cells cannot hold a figure fence — keep a simple image (later a short `[id]`). */
function flattenEmbeddedImages(node: GenericNode): GenericNode {
  const image =
    firstTableImage(node) ??
    looseImageFromText((node.children ?? []).map((child) => String(child.value ?? "")).join("\n"));
  if (image && isEmbeddedUrl(image.url) && (node.type === "tableCell" || node.type === "tablecell")) {
    return { ...node, children: [{ type: "paragraph", children: [simpleImage(image)] }] };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map(flattenEmbeddedImages) };
}

function figureHasImage(node: GenericNode): boolean {
  if (isImageLike(node)) return Boolean(imageNodeUrl(node));
  return (node.children ?? []).some(figureHasImage);
}

/** myst-to-md reads `node.source.label` when a figure has no image child. */
function flattenEmptyFigures(node: GenericNode): GenericNode {
  const children = node.children?.map(flattenEmptyFigures);
  const next = children ? { ...node, children } : node;
  if (next.type === "container" && next.kind === "figure" && !figureHasImage(next)) {
    return { type: "paragraph", children: next.children ?? [] };
  }
  return next;
}

function serializeBody(ast: GenericNode): string {
  const prepared = structuredClone(
    flattenEmbeddedImages(
      flattenEmptyFigures(
        padTableColumns(unwrapFigureDirectives(promotePipeParagraphs(resolveImageReferences(ast))))
      )
    )
  );
  const stubber = createDataUrlStubber();
  stubber.stubTree(prepared as { [key: string]: unknown });
  const file = new VFile();
  writeMd(file, prepared as never);
  const result = (file as { result?: string }).result;
  const raw = (typeof result === "string" ? result : String(file.value ?? "")).trim();
  // CommonMark reference images: short `![alt][img-…]` in the body, data URLs at the end.
  const restored = rewriteTickFigureFences(rewriteEmbeddedImageFences(stubber.restore(raw)));
  return unescapeGfmTablePipes(rewriteMarkdownToWikiLinks(rewriteEmbeddedImagesToReferences(restored)));
}

export function serializeMarkdown(options: {
  ast: GenericNode;
  yaml?: YamlDocument | null;
}): string {
  const body = serializeBody(options.ast);
  if (options.yaml && !options.yaml.errors.length) {
    const yamlText = dumpYaml(options.yaml).trim();
    if (!yamlText || yamlText === "undefined" || yamlText === "") {
      return body ? `${body}\n` : "";
    }
    return `---\n${yamlText}\n---\n${body ? `\n${body}\n` : "\n"}`;
  }
  return body ? `${body}\n` : "";
}
