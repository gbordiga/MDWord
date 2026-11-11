import { describe, expect, it } from "vitest";
import { pdfToMarkdown, type PdfItem } from "./pdfMarkdown";

const at = (text: string, y: number, size = 10, x = 50): PdfItem => ({ text, x, y, size });

function page(n: number, body: PdfItem[]): PdfItem[] {
  return [at("Acme report", 800, 8), ...body, at(`Page ${n}`, 20, 8)];
}

describe("pdfToMarkdown", () => {
  it("finds headings, joins wrapped lines, mends hyphens, and splits paragraphs", () => {
    const pages = [1, 2, 3].map((n) =>
      page(n, [
        at("Annual review", 700, 20),
        at("The year was good and the team grew", 660),
        at("by a third, with strong inter-", 648),
        at("national sales.", 636),
        at("A new paragraph starts here.", 600),
        at("Results", 560, 14),
        at("• First point", 530),
        at("• Second point", 518),
        at("1. Step one", 490)
      ])
    );
    const md = pdfToMarkdown(pages);
    expect(md).toContain("# Annual review");
    expect(md).toContain("## Results");
    expect(md).toContain("The year was good and the team grew by a third, with strong international sales.");
    expect(md).toContain("\n\nA new paragraph starts here.");
    expect(md).toContain("- First point\n- Second point");
    expect(md).toContain("1. Step one");
  });

  it("drops repeated headers, footers, and page numbers", () => {
    const pages = [1, 2, 3].map((n) => page(n, [at(`Body of page ${n}`, 500)]));
    const md = pdfToMarkdown(pages);
    expect(md).not.toContain("Acme report");
    expect(md).not.toContain("Page 1");
    expect(md).toContain("Body of page 2");
  });

  it("is empty for a page with no text", () => {
    expect(pdfToMarkdown([[]])).toBe("");
  });
});
