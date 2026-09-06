import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  extractWikiLinks,
  formatWikiLink,
  parseWikiLinkInner,
  rewriteMarkdownToWikiLinks,
  rewriteWikiLinksToMarkdown
} from "./wikilink";

describe("wikilinks", () => {
  it("parses all documented forms", () => {
    expect(parseWikiLinkInner("[[Documento]]")?.target).toBe("Documento");
    expect(parseWikiLinkInner("[[Documento|testo]]")?.label).toBe("testo");
    expect(parseWikiLinkInner("[[Documento\\|testo]]")?.target).toBe("Documento");
    expect(parseWikiLinkInner("[[Documento\\|testo]]")?.label).toBe("testo");
    expect(parseWikiLinkInner("[[Documento#Sezione]]")?.section).toBe("Sezione");
    expect(parseWikiLinkInner("[[Cartella/Documento]]")?.target).toBe(
      "Cartella/Documento"
    );
  });

  it("does not rewrite links inside fences", () => {
    const src = "```\n[[keep]]\n```\n\n[[Doc]]\n";
    const rewritten = rewriteWikiLinksToMarkdown(src);
    expect(rewritten).toContain("[[keep]]");
    expect(rewritten).toContain("mdoc-wiki:");
  });

  it("round-trips wikilink rewrite", () => {
    const samples = [
      "See [[Alpha]] and [[Beta|label]] and [[folder/X#H]].",
      "[[Documento]]"
    ];
    for (const sample of samples) {
      const md = rewriteWikiLinksToMarkdown(sample);
      const back = rewriteMarkdownToWikiLinks(md);
      expect(extractWikiLinks(back).map((w) => w.target)).toEqual(
        extractWikiLinks(sample).map((w) => w.target)
      );
    }
  });

  it("property: target characters survive encode/decode", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 24 })
          .filter((s) => !/[\]|#\n[]/.test(s) && s.trim().length > 0 && !/\\+$/.test(s)),
        (target) => {
          const formatted = formatWikiLink({ target: target.trim(), raw: "" });
          const parsed = parseWikiLinkInner(formatted);
          expect(parsed?.target).toBe(target.trim());
        }
      )
    );
  });

  it("parses GFM-escaped wiki pipes inside tables", () => {
    const cell = "[[ID015 - Manuale di laboratorio\\|ID015 — Manuale di laboratorio]]";
    const parsed = parseWikiLinkInner(cell);
    expect(parsed?.target).toBe("ID015 - Manuale di laboratorio");
    expect(parsed?.label).toBe("ID015 — Manuale di laboratorio");
    const rewritten = rewriteWikiLinksToMarkdown(`| ${cell} | other |\n| --- | --- |\n`);
    expect(rewritten).toContain("<mdoc-wiki:");
    expect(extractWikiLinks(cell)[0]?.target).not.toMatch(/\\$/);
    const back = rewriteMarkdownToWikiLinks(rewritten);
    expect(extractWikiLinks(back)[0]?.target).toBe("ID015 - Manuale di laboratorio");
  });
});
