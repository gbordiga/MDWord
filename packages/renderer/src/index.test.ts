import { describe, expect, it } from "vitest";
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
    expect(html).toContain("print-running-header");
    expect(html).toContain("print-running-footer");
  });
});
