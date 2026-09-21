import { describe, expect, it } from "vitest";
import { withTableMeta } from "@mdword/shared";
import { astToHtml, collectTocItems, headerFooterFromHtml, renderPrintDocument } from "./index";

describe("renderer security", () => {
  it("strips script tags from injected HTML nodes", () => {
    const html = astToHtml({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "<script>alert(1)</script>" }] },
        {
          type: "html",
          value: '<script>alert(1)</script><img src="x" onerror="alert(1)" />'
        }
      ]
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img[^>]+onerror/i);
  });

  it("places a table with MyST :align: using margin, not full width", () => {
    const html = astToHtml({
      type: "root",
      children: [
        withTableMeta(
          {
            type: "table",
            children: [
              {
                type: "tableRow",
                children: [
                  { type: "tableCell", header: true, children: [{ type: "text", value: "A" }] },
                  { type: "tableCell", header: true, children: [{ type: "text", value: "B" }] }
                ]
              }
            ]
          },
          { align: "center" }
        )
      ]
    });
    expect(html).toMatch(/<table[^>]*style="width:auto;margin:0 auto;?"/);
  });

  it("renders a pipe paragraph as a table", () => {
    const html = astToHtml({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "image", url: "./a.png", alt: "poster" },
            {
              type: "text",
              value: "| b |\n| --- | --- |\n| 1 | 2 |"
            }
          ]
        }
      ]
    });
    expect(html).toMatch(/<table\b/);
    expect(html).toContain("<td>");
  });

  it("renders an imageReference the same way as an image", () => {
    const html = astToHtml({
      type: "root",
      children: [
        {
          type: "container",
          kind: "figure",
          children: [{ type: "imageReference", identifier: "img-x", alt: "pic", url: "data:image/png;base64,AAAA" }]
        }
      ]
    });
    expect(html).toContain("<figure");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('alt="pic"');
  });

  it("renders a mermaid fence as a figure, not a plain code block", () => {
    const html = astToHtml({
      type: "root",
      children: [{ type: "code", lang: "mermaid", value: "flowchart TB\n  A --> B" }]
    });
    expect(html).toContain('class="md-mermaid"');
    expect(html).toContain("flowchart TB");
    expect(html).toContain("A --&gt; B");
    expect(html).not.toMatch(/<pre><code>flowchart/);
  });

  it("renders a mermaid directive the same way", () => {
    const html = astToHtml({
      type: "root",
      children: [{ type: "mystDirective", name: "mermaid", value: "sequenceDiagram\n  A->>B: hi" }]
    });
    expect(html).toContain('class="md-mermaid"');
    expect(html).toContain("sequenceDiagram");
  });

  it("keeps data URL images", () => {
    const html = astToHtml({
      type: "root",
      children: [
        {
          type: "image",
          url: "data:image/png;base64,AAAA",
          alt: "dot"
        }
      ]
    });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });
});

describe("table of contents", () => {
  const ast = {
    type: "root",
    children: [
      { type: "heading", depth: 1, children: [{ type: "text", value: "Chapter" }] },
      { type: "heading", depth: 2, children: [{ type: "text", value: "Section" }] }
    ]
  };

  it("collects numbered headings up to depth", () => {
    const items = collectTocItems(ast, 2);
    expect(items).toEqual([
      { depth: 1, text: "Chapter", number: "1" },
      { depth: 2, text: "Section", number: "1.1" }
    ]);
  });

  it("injects a live TOC when mdoc.toc.enabled is set", () => {
    const html = renderPrintDocument({
      ast,
      mdoc: { version: 1, toc: { enabled: true, depth: 3 }, numbering: { headings: true } },
      title: "Doc"
    });
    expect(html).toContain('data-toc="true"');
    expect(html).toContain("Contents");
    expect(html).toContain("1 Chapter");
    expect(html).toContain("1.1 Section");
  });
});

describe("running header and footer", () => {
  it("leaves page tokens for Chromium print templates", () => {
    const html = renderPrintDocument({
      ast: { type: "root", children: [] },
      mdoc: {
        version: 1,
        header: { left: "{{title}}", right: "{{page}} / {{pages}}" },
        footer: { center: "{{date}}" }
      },
      title: "Audit",
      date: "2026-01-01"
    });
    expect(html).toContain("<!-- header-left:Audit -->");
    expect(html).toContain("<!-- header-right:{{page}} / {{pages}} -->");
    expect(html).toContain("<!-- footer-center:2026-01-01 -->");
    const templates = headerFooterFromHtml(html);
    expect(templates.headerTemplate).toContain("Audit");
    expect(templates.headerTemplate).toContain('class="pageNumber"');
    expect(templates.footerTemplate).toContain("2026-01-01");
    expect(html).toMatch(/@top-left/);
    expect(html).not.toContain("print-running-header");
  });

  it("writes title and date into the document body", () => {
    const html = renderPrintDocument({
      ast: { type: "root", children: [] },
      mdoc: { version: 1, header: { left: "{{title}}" }, footer: { right: "{{date}}" } },
      title: "Audit",
      date: "2026-01-01",
      runningInBody: true
    });
    expect(html).toContain('class="doc-title"');
    expect(html).toContain("Audit");
    expect(html).toContain('class="doc-date"');
    expect(html).toMatch(/<p class="doc-date">2026-01-01<\/p>/);
    expect(html).toContain('class="print-running print-running-header"');
    expect(html).toContain("print-running-footer");
    expect(html).toContain('class="print-root"');
    expect(html).not.toMatch(/@top-left/);
    expect(html).not.toMatch(/@bottom-right/);
    expect(html).not.toMatch(/position:\s*fixed/);
    expect(html).not.toContain("print-page");
  });

  it("puts page numbers in @page boxes and strips tokens from HTML bars", () => {
    const html = renderPrintDocument({
      ast: { type: "root", children: [] },
      mdoc: {
        version: 1,
        header: { left: "{{title}}", right: "{{page}} / {{pages}}" },
        footer: { right: "{{date}}" }
      },
      title: "Audit",
      date: "2026-01-01",
      runningInBody: true
    });
    expect(html).toContain('class="print-running print-running-header"');
    const headerBar = html.match(/class="print-running print-running-header">[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(headerBar).toContain("Audit");
    expect(headerBar).not.toContain("{{page}}");
    expect(html).toMatch(/@top-right/);
    expect(html).toMatch(/counter\(page\)/);
    expect(html).not.toMatch(/@top-left/);
  });

  it("uses @page boxes instead of a print table when Paged.js is loaded", () => {
    const html = renderPrintDocument({
      ast: { type: "root", children: [] },
      mdoc: {
        version: 1,
        header: { left: "{{title}}", right: "{{page}} / {{pages}}" },
        footer: { right: "{{date}}" }
      },
      title: "Audit",
      date: "2026-01-01",
      runningInBody: true,
      pagedScriptUrl: "https://example.test/paged.polyfill.min.js"
    });
    expect(html).not.toContain("print-running-header");
    expect(html).not.toContain("print-root");
    expect(html).not.toContain("<thead>");
    expect(html).toContain('class="doc-title"');
    expect(html).toContain("Audit");
    expect(html).toMatch(/@top-left/);
    expect(html).toMatch(/@top-right/);
    expect(html).toMatch(/@bottom-right/);
    expect(html).toMatch(/counter\(page\)/);
    expect(html).toMatch(/counter\(pages\)/);
    expect(html).toContain("https://example.test/paged.polyfill.min.js");
    expect(html).toContain("pagedReady");
    expect(html).not.toContain("print-page");
    expect(html).not.toMatch(/position:\s*fixed/);
  });

  it("styles running boxes like the on-screen page chrome", () => {
    const html = renderPrintDocument({
      ast: { type: "root", children: [] },
      mdoc: { version: 1, header: { left: "{{title}}" } },
      title: "Audit"
    });
    expect(html).toMatch(/font-size:\s*10px/);
    expect(html).toMatch(/color:\s*#667085/);
  });

  it("prints tables with auto column layout and no cell paragraph gap", () => {
    const html = renderPrintDocument({
      ast: { type: "root", children: [] },
      mdoc: { version: 1 },
      title: "Doc"
    });
    expect(html).toMatch(/table-layout:\s*auto/);
    expect(html).toMatch(/th p,\s*td p \{ margin: 0; \}/);
  });
});
