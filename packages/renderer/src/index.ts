import sanitizeHtml from "sanitize-html";
import type { GenericNode } from "@mdword/shared";
import { decodeWikiHref, WIKI_SCHEME } from "@mdword/shared";
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

function renderNodes(nodes: GenericNode[] | undefined): string {
  return (nodes ?? []).map(renderNode).join("");
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
      return `<img src="${escape(String(node.url ?? ""))}" alt="${escape(String(node.alt ?? ""))}" />`;
    case "list": {
      const ordered = Boolean(node.ordered);
      const tag = ordered ? "ol" : "ul";
      return `<${tag}>${renderNodes(node.children)}</${tag}>`;
    }
    case "listItem":
      return `<li>${renderNodes(node.children)}</li>`;
    case "blockquote":
      return `<blockquote>${renderNodes(node.children)}</blockquote>`;
    case "code":
    case "codeBlock":
      return `<pre><code>${escape(String(node.value ?? ""))}</code></pre>`;
    case "thematicBreak":
      return "<hr />";
    case "table":
      return `<table>${renderNodes(node.children)}</table>`;
    case "tableRow":
      return `<tr>${renderNodes(node.children)}</tr>`;
    case "tableCell": {
      const tag = node.header ? "th" : "td";
      return `<${tag}>${renderNodes(node.children)}</${tag}>`;
    }
    case "admonition": {
      const kind = String(node.kind ?? node.class ?? "note");
      return `<aside class="admonition ${escape(kind)}">${renderNodes(node.children)}</aside>`;
    }
    case "admonitionTitle":
      return `<p class="admonition-title">${renderNodes(node.children)}</p>`;
    case "figure":
      return `<figure>${renderNodes(node.children)}</figure>`;
    case "caption":
      return `<figcaption>${renderNodes(node.children)}</figcaption>`;
    case "mystDirective": {
      const name = String(node.name ?? "");
      if (name === "page-break") return `<div class="page-break"></div>`;
      const kinds = ["note", "tip", "warning", "important", "caution", "danger", "error", "hint"];
      if (kinds.includes(name)) {
        return `<aside class="admonition ${escape(name)}"><p class="admonition-title">${escape(name)}</p>${renderNodes(node.children)}</aside>`;
      }
      if (name === "figure") {
        return `<figure>${renderNodes(node.children)}</figure>`;
      }
      const raw = String(node.value ?? renderNodes(node.children));
      return `<pre class="unsupported-directive" data-directive="${escape(name)}">${escape(raw)}</pre>`;
    }
    default:
      if (node.children) return renderNodes(node.children);
      if (node.value) return escape(String(node.value));
      return "";
  }
}

export function astToHtml(ast: GenericNode): string {
  const html = renderNode(ast);
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "figure",
      "figcaption",
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
      "td"
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "class", "title"],
      img: ["src", "alt", "title"],
      aside: ["class"],
      div: ["class"],
      nav: ["class", "data-toc"],
      li: ["class"],
      p: ["class"],
      pre: ["class", "data-directive"],
      td: ["align", "colspan", "rowspan"],
      th: ["align", "colspan", "rowspan"]
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
  const bodyFont =
    options.mdoc.typography?.body?.["font-family"] ??
    "Aptos, Calibri, Carlito, Segoe UI, system-ui, sans-serif";
  const bodySize = options.mdoc.typography?.body?.["font-size"] ?? "11pt";
  const lineHeight = String(options.mdoc.typography?.body?.["line-height"] ?? 1.15);
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
      size: ${metrics.widthMm}mm ${metrics.heightMm}mm;
      margin: ${options.mdoc.margins?.top ?? "20mm"} ${options.mdoc.margins?.right ?? "20mm"} ${options.mdoc.margins?.bottom ?? "20mm"} ${options.mdoc.margins?.left ?? "25mm"};
      ${pageBoxes}
    }
    html, body {
      font-family: ${bodyFont};
      font-size: ${bodySize};
      line-height: ${lineHeight};
      color: #111;
    }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; }
    .page-break { break-after: page; page-break-after: always; }
    .admonition { border-left: 4px solid #2563eb; padding: 8px 12px; background: #f8fafc; margin: 12px 0; }
    .admonition.warning { border-color: #d97706; }
    .unsupported-directive { background: #f1f5f9; font-size: 0.9em; }
    h1 { font-size: ${options.mdoc.typography?.["heading-1"]?.["font-size"] ?? "20pt"}; }
    h2 { font-size: ${options.mdoc.typography?.["heading-2"]?.["font-size"] ?? "16pt"}; }
    ul { list-style: disc outside; padding-left: 1.5em; }
    ol { list-style: decimal outside; padding-left: 1.5em; }
    li { display: list-item; }
    blockquote { border-left: 3px solid #1d4ed8; padding-left: 1em; margin: 0.7em 0; color: #344054; font-style: italic; }
    a { color: #1d4ed8; text-decoration: underline; }
    .toc { border-bottom: 1px solid #d0d5dd; margin: 0 0 1.2em; padding-bottom: 0.8em; }
    .toc h2 { font-size: 14pt; margin: 0 0 0.4em; }
    .toc ol { list-style: none; padding: 0; margin: 0; }
    .toc-d2 { margin-left: 1.2em; }
    .toc-d3 { margin-left: 2.4em; }
    .toc-d4 { margin-left: 3.6em; }
    .toc-empty { color: #667085; }
    .doc-masthead { margin: 0 0 1.1em; }
    .doc-title { font-size: 22pt; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 0.2em; }
    .doc-subtitle { font-size: 12pt; color: #4b5563; margin: 0 0 0.35em; }
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
