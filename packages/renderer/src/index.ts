import sanitizeHtml from "sanitize-html";
import type { GenericNode } from "@mdword/shared";
import {
  buildNumberingIndex,
  decodeWikiHref,
  extractTableFromDirective,
  formatReferenceDisplay,
  getTableMeta,
  imageNodeUrl,
  isImageLike,
  isMermaidAstNode,
  isMystCalloutKind,
  mermaidSourceFromNode,
  promotePipeParagraphs,
  resolveImageReferences,
  resolveCrossReference,
  withTableMeta,
  WIKI_SCHEME,
  type TableMeta
} from "@mdword/shared";
import { mermaidFigureHtml } from "./mermaid";
import { renderKatex } from "./katex";

export { hydrateMermaidHtml, renderMermaidSvg } from "./mermaid";
export { renderKatex, renderKatexInto } from "./katex";
import { pageMetrics, type Mdoc } from "@mdword/layout-engine";
import { collectTocItems, renderTocHtml } from "./toc";
import { pageMarginCss, resolvedRunningComments, runningBarsHtml } from "./running";

export { collectTocItems, renderTocHtml, type TocItem } from "./toc";

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtmlTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open);
    const close = html.indexOf(">", open + 1);
    if (close === -1) break;
    i = close + 1;
  }
  return out;
}

function layoutClass(node: GenericNode | { align?: unknown; class?: unknown }): string {
  const classes = String(node.class ?? "");
  const floated = /\bfloat\b/.test(classes);
  const align = String(node.align ?? "").toLowerCase();
  if (floated && align === "right") return "md-layout-float-right";
  if (floated) return "md-layout-float-left";
  if (align === "left") return "md-layout-block-left";
  if (align === "right") return "md-layout-block-right";
  return "md-layout-block-center";
}

function renderImg(node: GenericNode): string {
  const src = escape(imageNodeUrl(node));
  const alt = escape(String(node.alt ?? ""));
  const width = node.width != null && String(node.width) ? ` width="${escape(String(node.width))}"` : "";
  const cls = layoutClass(node);
  return `<img src="${src}" alt="${alt}"${width} class="${cls}" />`;
}

function findImage(node: GenericNode): GenericNode | undefined {
  if (isImageLike(node)) return node;
  for (const child of node.children ?? []) {
    const found = findImage(child);
    if (found) return found;
  }
  return undefined;
}

function renderFigure(node: GenericNode): string {
  const image = findImage(node) ?? node;
  const options = (node.options ?? {}) as Record<string, unknown>;
  const width = image.width ?? options.width;
  const align = image.align ?? options.align ?? node.align;
  const className = image.class ?? options.class ?? node.class;
  const url = imageNodeUrl(image) || node.args || node.url;
  const alt = image.alt ?? options.alt ?? "";
  const cls = layoutClass({ type: "image", align, class: className });
  const widthAttr = width != null && String(width) ? ` style="width:${escape(String(width))}"` : "";
  const img = `<img src="${escape(String(url ?? ""))}" alt="${escape(String(alt))}" />`;
  const captionBits: string[] = [];
  const walkCaption = (n: GenericNode) => {
    if (isImageLike(n)) return;
    if (n.type === "caption" || n.type === "paragraph") {
      const text = renderNodes(n.children).trim();
      if (text) captionBits.push(text);
      return;
    }
    n.children?.forEach(walkCaption);
  };
  (node.children ?? []).forEach(walkCaption);
  if (typeof node.value === "string" && node.value.trim() && !captionBits.length) {
    captionBits.push(escape(node.value.trim()));
  }
  const cap = captionBits.length ? `<figcaption>${captionBits.join(" ")}</figcaption>` : "";
  return `<figure class="md-figure ${cls}"${widthAttr}>${img}${cap}</figure>`;
}

function renderNodes(nodes: GenericNode[] | undefined): string {
  return (nodes ?? []).map(renderNode).join("");
}

let numberingIndex = buildNumberingIndex({ type: "root", children: [] });

function prepareNumbering(ast: GenericNode): void {
  numberingIndex = buildNumberingIndex(ast);
}

function tableColgroup(meta: TableMeta, colCount: number): string {
  if (!meta.widths || meta.widths === "auto") return "";
  const weights = Array.isArray(meta.widths) ? meta.widths : Array(colCount).fill(1);
  const total = weights.reduce((a, b) => a + b, 0);
  const cols = weights
    .map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%" />`)
    .join("");
  return `<colgroup>${cols}</colgroup>`;
}

function renderTableNode(node: GenericNode, meta: TableMeta): string {
  const rows = node.children ?? [];
  const colCount = Math.max(...rows.map((r) => r.children?.length ?? 0), 1);
  const align = meta.align
    ? ` style="width:auto;margin:${meta.align === "center" ? "0 auto" : meta.align === "right" ? "0 0 0 auto" : "0"};"`
    : "";
  const width = meta.width ? ` width="${escape(String(meta.width))}"` : "";
  const cap = meta.caption ? `<caption>${escape(meta.caption)}</caption>` : "";
  const body = renderNodes(rows);
  return `<table class="md-table"${width}${align}>${cap}${tableColgroup(meta, colCount)}${body}</table>`;
}

function renderNode(node: GenericNode): string {
  switch (node.type) {
    case "root":
      return renderNodes(node.children);
    case "paragraph":
      return `<p>${renderNodes(node.children)}</p>`;
    case "heading": {
      const depth = Math.min(6, Math.max(1, Number(node.depth ?? 1)));
      return `<h${depth}>${renderNodes(node.children)}</h${depth}>`;
    }
    case "text":
      return escape(String(node.value ?? ""));
    case "strong":
      return `<strong>${renderNodes(node.children)}</strong>`;
    case "emphasis":
      return `<em>${renderNodes(node.children)}</em>`;
    case "delete":
    case "strikethrough":
      return `<s>${renderNodes(node.children)}</s>`;
    case "inlineCode":
      return `<code>${escape(String(node.value ?? ""))}</code>`;
    case "inlineMath":
      return `<span class="md-inline-math">${renderKatex(String(node.value ?? ""), false)}</span>`;
    case "subscript":
      return `<sub>${renderNodes(node.children)}</sub>`;
    case "superscript":
      return `<sup>${renderNodes(node.children)}</sup>`;
    case "underline":
      return `<u>${renderNodes(node.children)}</u>`;
    case "abbreviation":
      return `<abbr title="${escape(String(node.title ?? ""))}">${renderNodes(node.children)}</abbr>`;
    case "crossReference": {
      const label = String(node.label ?? node.identifier ?? "");
      const target = resolveCrossReference(label, numberingIndex);
      const text = formatReferenceDisplay(target, String(node.kind ?? "ref"));
      return `<span class="md-cross-ref">${escape(text)}</span>`;
    }
    case "cite":
      return `<span class="md-cite">[${escape(String(node.label ?? node.identifier ?? ""))}]</span>`;
    case "footnoteReference":
      return `<sup class="md-footnote-ref">${escape(String(node.identifier ?? node.label ?? ""))}</sup>`;
    case "break":
      return "<br />";
    case "link": {
      const url = String(node.url ?? "");
      if (url.startsWith(WIKI_SCHEME)) {
        const wiki = decodeWikiHref(url);
        const label = renderNodes(node.children) || wiki?.target || "";
        return `<a class="wikilink" href="#wiki:${encodeURIComponent(wiki?.target ?? "")}">${label}</a>`;
      }
      const safe = /^(https?:|mailto:|#|\/|\.)/.test(url) ? url : "#";
      return `<a href="${escape(safe)}">${renderNodes(node.children)}</a>`;
    }
    case "image":
    case "imageReference":
      return renderImg(node);
    case "html":
      return String(node.value ?? "");
    case "list": {
      const ordered = Boolean(node.ordered);
      const task = node.children?.some((c) => c.checked !== undefined);
      if (task) {
        return `<ul class="task-list">${renderNodes(node.children)}</ul>`;
      }
      const tag = ordered ? "ol" : "ul";
      return `<${tag}>${renderNodes(node.children)}</${tag}>`;
    }
    case "listItem": {
      if (node.checked !== undefined) {
        const mark = node.checked ? "checked" : "";
        return `<li class="task-list-item"><input type="checkbox" disabled ${mark} /> ${renderNodes(node.children)}</li>`;
      }
      return `<li>${renderNodes(node.children)}</li>`;
    }
    case "blockquote":
      return `<blockquote>${renderNodes(node.children)}</blockquote>`;
    case "math": {
      const label = String(node.label ?? node.identifier ?? "");
      const target = label ? resolveCrossReference(label, numberingIndex) : undefined;
      const num = target?.number;
      const numHtml = num ? `<span class="md-equation-number">(${escape(num)})</span>` : "";
      return `<div class="md-math-block">${renderKatex(String(node.value ?? ""), true)}${numHtml}</div>`;
    }
    case "code":
    case "codeBlock":
      if (isMermaidAstNode(node)) return mermaidFigureHtml(mermaidSourceFromNode(node));
      const lang = node.lang ? ` class="language-${escape(String(node.lang))}"` : "";
      return `<pre><code${lang}>${escape(String(node.value ?? ""))}</code></pre>`;
    case "mermaid":
      return mermaidFigureHtml(mermaidSourceFromNode(node));
    case "thematicBreak":
      return "<hr />";
    case "table":
      return renderTableNode(node, getTableMeta(node));
    case "tableRow":
      return `<tr>${renderNodes(node.children)}</tr>`;
    case "tableCell": {
      const tag = node.header ? "th" : "td";
      const align = node.align ? ` style="text-align:${escape(String(node.align))}"` : "";
      return `<${tag}${align}>${renderNodes(node.children)}</${tag}>`;
    }
    case "admonition": {
      const kind = String(node.kind ?? node.class ?? "note");
      return `<aside class="admonition ${escape(kind)}">${renderNodes(node.children)}</aside>`;
    }
    case "admonitionTitle":
      return `<p class="admonition-title">${renderNodes(node.children)}</p>`;
    case "figure":
    case "container":
      if (node.type === "container" && node.kind === "table") {
        const table = node.children?.find((c) => c.type === "table");
        if (table) {
          const caption = node.children?.find((c) => c.type === "caption");
          const captionText = caption ? stripHtmlTags(renderNodes(caption.children)).trim() : null;
          const meta = {
            ...getTableMeta(table),
            caption: captionText,
            label: String(node.label ?? node.identifier ?? "") || null,
            sourceKind: "table" as const
          };
          return renderTableNode(withTableMeta(table, meta), meta);
        }
      }
      if (node.type === "container" && node.kind !== "figure") {
        return renderNodes(node.children);
      }
      return renderFigure(node);
    case "caption":
      return `<figcaption>${renderNodes(node.children)}</figcaption>`;
    case "mystDirective": {
      const name = String(node.name ?? "");
      if (name === "page-break") return `<div class="page-break"></div>`;
      if (name === "mermaid") return mermaidFigureHtml(mermaidSourceFromNode(node));
      if (isMystCalloutKind(name)) {
        const inner = node.children?.find((c) => c.type === "admonition");
        if (inner) return renderNode(inner);
        const title = node.args ? String(node.args) : name;
        return `<aside class="admonition ${escape(name)}"><p class="admonition-title">${escape(title)}</p>${renderNodes(node.children)}</aside>`;
      }
      if (name === "table" || name === "list-table" || name === "csv-table") {
        const extracted = extractTableFromDirective(node);
        if (extracted.table) {
          return renderTableNode(withTableMeta(extracted.table, extracted.meta), extracted.meta);
        }
      }
      if (name === "math" || name === "equation") {
        const options = (node.options ?? {}) as Record<string, unknown>;
        return renderNode({ type: "math", value: node.value, label: options.label });
      }
      if (name === "figure" || name === "image") {
        return renderFigure(node);
      }
      const raw = String(node.value ?? renderNodes(node.children));
      return `<aside class="md-myst-raw-card unsupported-directive" data-directive="${escape(name)}"><div class="md-myst-raw-head">${escape(name)}</div><pre class="md-myst-raw-body">${escape(raw)}</pre></aside>`;
    }
    case "mystRole": {
      const inner = node.children?.[0];
      return inner ? renderNode(inner) : escape(String(node.value ?? ""));
    }
    default:
      if (node.children) return renderNodes(node.children);
      if (node.value) return escape(String(node.value));
      return "";
  }
}

export function astToHtml(ast: GenericNode): string {
  const prepared = promotePipeParagraphs(resolveImageReferences(ast));
  prepareNumbering(prepared);
  const html = renderNode(prepared);
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "figure",
      "figcaption",
      "caption",
      "colgroup",
      "col",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "aside",
      "section",
      "header",
      "footer",
      "nav",
      "table",
      "thead",
      "tbody",
      "th",
      "tr",
      "td",
      "sub",
      "sup",
      "abbr",
      "u",
      "span",
      "input"
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "class", "title"],
      img: ["src", "alt", "title", "width", "class"],
      figure: ["class", "style"],
      figcaption: ["class"],
      aside: ["class", "data-directive"],
      nav: ["class", "data-toc"],
      li: ["class"],
      p: ["class"],
      pre: ["class", "data-directive"],
      td: ["align", "colspan", "rowspan", "style"],
      th: ["align", "colspan", "rowspan", "style"],
      table: ["class", "width", "style"],
      col: ["style"],
      span: ["class", "data-label", "data-kind", "data-display"],
      input: ["type", "disabled", "checked"],
      div: ["class", "data-math-block", "data-latex"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"]
    },
    allowProtocolRelative: false
  });
}

function headingNumberCss(): string {
  return `
    .doc-body { counter-reset: h1; }
    .doc-body h1 { counter-increment: h1; counter-reset: h2; }
    .doc-body h1::before { content: counter(h1) ". "; }
    .doc-body h2 { counter-increment: h2; counter-reset: h3; }
    .doc-body h2::before { content: counter(h1) "." counter(h2) " "; }
    .doc-body h3 { counter-increment: h3; counter-reset: h4; }
    .doc-body h3::before { content: counter(h1) "." counter(h2) "." counter(h3) " "; }
  `;
}

export function renderPrintDocument(options: {
  ast: GenericNode;
  mdoc: Mdoc;
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  filename?: string;
  /**
   * Repeat header/footer as a print table (thead/tfoot). Chromium's native print
   * can repeat those rows, but Paged.js cannot fragment that table — combining
   * the two leaves page 1 empty and the running bars only on the first page.
   * Web Chromium should pass pagedScriptUrl instead and leave this false.
   */
  runningInBody?: boolean;
  /** Same-origin Paged.js polyfill so @page boxes and page counters work in Chromium. */
  pagedScriptUrl?: string;
}): string {
  const metrics = pageMetrics(options.mdoc);
  const bodyFont = escape(
    options.mdoc.typography?.body?.["font-family"] ??
      "Aptos, Calibri, Carlito, Segoe UI, system-ui, sans-serif"
  );
  const bodySize = escape(options.mdoc.typography?.body?.["font-size"] ?? "11pt");
  const lineHeight = escape(String(options.mdoc.typography?.body?.["line-height"] ?? 1.15));
  const pageWidth = escape(String(metrics.widthMm));
  const pageHeight = escape(String(metrics.heightMm));
  const marginTop = escape(options.mdoc.margins?.top ?? "20mm");
  const marginRight = escape(options.mdoc.margins?.right ?? "20mm");
  const marginBottom = escape(options.mdoc.margins?.bottom ?? "20mm");
  const marginLeft = escape(options.mdoc.margins?.left ?? "25mm");
  const h1Size = escape(options.mdoc.typography?.["heading-1"]?.["font-size"] ?? "20pt");
  const h1Weight = escape(String(options.mdoc.typography?.["heading-1"]?.weight ?? 700));
  const h2Size = escape(options.mdoc.typography?.["heading-2"]?.["font-size"] ?? "16pt");
  const h2Weight = escape(String(options.mdoc.typography?.["heading-2"]?.weight ?? 650));
  const h3Size = escape(options.mdoc.typography?.["heading-3"]?.["font-size"] ?? "14pt");
  const h3Weight = escape(String(options.mdoc.typography?.["heading-3"]?.weight ?? 650));
  const h4Size = escape(options.mdoc.typography?.["heading-4"]?.["font-size"] ?? "12pt");
  const h4Weight = escape(String(options.mdoc.typography?.["heading-4"]?.weight ?? 650));
  const titleSize = escape(options.mdoc.typography?.title?.["font-size"] ?? "28pt");
  const subtitleSize = escape(options.mdoc.typography?.subtitle?.["font-size"] ?? "14pt");
  const vars = {
    title: options.title ?? "",
    subtitle: options.subtitle ?? "",
    author: options.author ?? "",
    date: options.date ?? "",
    filename: options.filename ?? ""
  };
  const header = options.mdoc.header ?? {};
  const footer = options.mdoc.footer ?? {};
  const numbered = Boolean(options.mdoc.numbering?.headings);
  const tocEnabled = Boolean(options.mdoc.toc?.enabled);
  const tocDepth = options.mdoc.toc?.depth ?? 3;
  const tocHtml = tocEnabled ? renderTocHtml(collectTocItems(options.ast, tocDepth), numbered) : "";
  const bodyHtml = astToHtml(options.ast);
  const masthead =
    options.title || options.subtitle || options.date
      ? `<header class="doc-masthead">
  ${options.title ? `<div class="doc-title">${escape(options.title)}</div>` : ""}
  ${options.subtitle ? `<p class="doc-subtitle">${escape(options.subtitle)}</p>` : ""}
  ${options.date ? `<p class="doc-date">${escape(options.date)}</p>` : ""}
</header>`
      : "";
  const useBodyBars = Boolean(options.runningInBody) && !options.pagedScriptUrl;
  const bars = useBodyBars ? runningBarsHtml(header, footer, vars) : { header: "", footer: "" };
  const pageBoxes = useBodyBars
    ? pageMarginCss(header, footer, vars, { pageTokensOnly: true })
    : pageMarginCss(header, footer, vars);
  const pagedScript = options.pagedScriptUrl
    ? `<script>window.PagedConfig={auto:true,after:function(){document.documentElement.dataset.pagedReady="1";}};<\/script>
  <script src="${escape(options.pagedScriptUrl)}" onerror="document.documentElement.dataset.pagedReady='1'"><\/script>`
    : "";
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>${escape(options.title ?? "Document")}</title>
  <style>
    @page {
      size: ${pageWidth}mm ${pageHeight}mm;
      margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft};
      ${escape(pageBoxes)}
    }
    html, body {
      font-family: ${bodyFont};
      font-size: ${bodySize};
      line-height: ${lineHeight};
      color: #111827;
    }
    img { max-width: 100%; height: auto; }
    figure.md-figure { margin: 12px 0; max-width: 100%; }
    .md-layout-block-center { text-align: center; }
    .md-layout-block-left { text-align: left; }
    .md-layout-block-right { text-align: right; }
    .md-layout-float-left { float: left; margin: 0 1em 0.75em 0; }
    .md-layout-float-right { float: right; margin: 0 0 0.75em 1em; }
    figcaption { font-size: 10pt; color: #4b5563; margin-top: 6px; }
    figure.md-mermaid { margin: 12px 0; text-align: center; }
    figure.md-mermaid svg { max-width: 100%; height: auto; }
    figure.md-mermaid pre.mermaid { text-align: left; white-space: pre-wrap; }
    .md-mermaid-error { color: #b42318; font-size: 10pt; margin: 0 0 8px; }
    p { margin: 0 0 0.6em; }
    table { border-collapse: collapse; width: 100%; table-layout: auto; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; min-width: 0; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
    th p, td p { margin: 0; }
    table tr:first-child:has(> th:empty):not(:has(th:not(:empty))) { display: none; }
    .page-break { break-after: page; page-break-after: always; }
    .admonition { border-left: 4px solid #2563eb; padding: 8px 12px; background: #f8fafc; margin: 12px 0; }
    .admonition.warning { border-color: #d97706; }
    .unsupported-directive, .md-myst-raw-card { background: #f1f5f9; font-size: 0.9em; border: 1px solid #e4e7ec; border-radius: 8px; margin: 12px 0; }
    .md-myst-raw-head { font-size: 10px; font-weight: 650; text-transform: uppercase; padding: 6px 10px; border-bottom: 1px solid #e4e7ec; }
    .md-myst-raw-body { margin: 0; padding: 10px 12px; white-space: pre-wrap; }
    .md-inline-math, .md-math-block { font-family: "Cambria Math", serif; }
    .md-math-block { text-align: center; margin: 12px 0; }
    .md-cite, .md-cross-ref { color: #3538cd; }
    table caption { caption-side: top; font-size: 10pt; color: #475467; margin-bottom: 6px; }
    ul.task-list { list-style: none; padding-left: 0; }
    li.task-list-item { display: flex; gap: 0.5em; align-items: flex-start; }
    h1 { font-size: ${h1Size}; font-weight: ${h1Weight}; }
    h2 { font-size: ${h2Size}; font-weight: ${h2Weight}; }
    h3 { font-size: ${h3Size}; font-weight: ${h3Weight}; }
    h4 { font-size: ${h4Size}; font-weight: ${h4Weight}; }
    ul { list-style: disc outside; padding-left: 1.5em; }
    ol { list-style: decimal outside; padding-left: 1.5em; }
    li { display: list-item; }
    blockquote { border-left: 3px solid #1d4ed8; padding-left: 1em; margin: 0.7em 0; color: #344054; font-style: italic; }
    a, a.md-link { color: #1d4ed8; text-decoration: underline; text-underline-offset: 0.14em; }
    u { text-decoration: underline; text-underline-offset: 0.14em; }
    code { font-family: Consolas, "Liberation Mono", ui-monospace, monospace; font-size: 0.9em; background: #f2f4f7; padding: 0.1em 0.35em; border-radius: 4px; }
    pre { background: #f2f4f7; border: 1px solid #e4e7ec; border-radius: 6px; padding: 10px 12px; }
    .wikilink { color: #1d4ed8; background: #e8eefc; border-radius: 4px; padding: 0 4px; }
    .toc { border-bottom: 1px solid #d0d5dd; margin: 0 0 1.2em; padding-bottom: 0.8em; }
    .toc h2 { font-size: 14pt; margin: 0 0 0.4em; }
    .toc ol { list-style: none; padding: 0; margin: 0; }
    .toc-d2 { margin-left: 1.2em; }
    .toc-d3 { margin-left: 2.4em; }
    .toc-d4 { margin-left: 3.6em; }
    .toc-empty { color: #667085; }
    .doc-masthead { margin: 0 0 1.1em; }
    .doc-title { font-size: ${titleSize}; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 0.2em; }
    .doc-subtitle { font-size: ${subtitleSize}; color: #4b5563; margin: 0 0 0.35em; }
    .doc-date { font-size: 10pt; color: #667085; margin: 0; }
    ${
      useBodyBars
        ? `.print-root { width: 100%; border-collapse: collapse; }
    .print-root > thead { display: table-header-group; }
    .print-root > tfoot { display: table-footer-group; }
    .print-root > thead th, .print-root > tbody td, .print-root > tfoot td { border: 0; padding: 0; background: transparent; }
    .print-running { display: flex; justify-content: space-between; font-size: 9pt; color: #444; }
    .print-running-header { border-bottom: 1px solid #d0d5dd; padding-bottom: 6px; margin-bottom: 8px; }
    .print-running-footer { border-top: 1px solid #d0d5dd; padding-top: 6px; margin-top: 8px; }`
        : ""
    }
    ${numbered ? headingNumberCss() : ""}
  </style>
  ${pagedScript}
</head>
<body>
  ${
    useBodyBars
      ? `<table class="print-root">
  <thead><tr><th>${bars.header}</th></tr></thead>
  <tfoot><tr><td>${bars.footer}</td></tr></tfoot>
  <tbody><tr><td>
  ${masthead}
  ${tocHtml}
  <div class="doc-body">
  ${bodyHtml}
  </div>
  </td></tr></tbody>
</table>`
      : `${bars.header}
  ${masthead}
  ${tocHtml}
  <div class="doc-body">
  ${bodyHtml}
  </div>
  ${bars.footer}`
  }
</body>
</html>
${resolvedRunningComments(options.mdoc, vars)}`;
}

export function headerFooterFromHtml(html: string): {
  headerTemplate: string;
  footerTemplate: string;
} {
  const grab = (name: string) => {
    const m = html.match(new RegExp(`<!-- ${name}:(.*?) -->`));
    return m?.[1] ?? "";
  };
  const cell = (text: string, align: string) =>
    `<span style="font-size:9px;color:#444;padding:0 8px;text-align:${align};width:33%;">${text
      .replace(/\{\{page\}\}/g, '<span class="pageNumber"></span>')
      .replace(/\{\{pages\}\}/g, '<span class="totalPages"></span>')}</span>`;
  return {
    headerTemplate: `<div style="width:100%;display:flex;justify-content:space-between;font-size:9px;">${cell(grab("header-left"), "left")}${cell(grab("header-center"), "center")}${cell(grab("header-right"), "right")}</div>`,
    footerTemplate: `<div style="width:100%;display:flex;justify-content:space-between;font-size:9px;">${cell(grab("footer-left"), "left")}${cell(grab("footer-center"), "center")}${cell(grab("footer-right"), "right")}</div>`
  };
}
