import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { documentToMarkdown, htmlToMarkdown, matchDocumentNames } from "./documents";

describe("documentToMarkdown", () => {
  it("turns HTML into headings, links, and lists", () => {
    const md = htmlToMarkdown(
      "<h1>Notes</h1><p>See <a href=\"https://example.com\">the source</a>.</p><ul><li>One</li><li>Two</li></ul><script>alert(1)</script>"
    );
    expect(md).toContain("# Notes");
    expect(md).toContain("[the source](https://example.com)");
    expect(md).toContain("- One");
    expect(md).not.toContain("alert");
    expect(htmlToMarkdown("<script >alert(1)</script >")).not.toContain("alert");
  });

  it("embeds an HTML picture as an image reference", () => {
    const md = htmlToMarkdown('<p>Logo</p><img alt="Logo" src="data:image/png;base64,AAAA">');
    expect(md).toMatch(/!\[Logo\]\[img-[0-9a-f]+\]/);
    expect(md).toContain("data:image/png;base64,AAAA");
  });

  it("ignores a slide image that points outside the package", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", `<p:sld><a:t>Inside</a:t><a:blip r:embed="rId9"/></p:sld>`);
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<Relationships><Relationship Id="rId9" Target="../../outside.png"/></Relationships>`
    );
    zip.file("outside.png", new Uint8Array([1, 2, 3]));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const md = await documentToMarkdown("deck.pptx", bytes);
    expect(md).toContain("Inside");
  });

  it("reads a slide image when the relationship lists Target before Id", async () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137
    ]);
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", `<p:sld><a:blip r:embed="rId2"/></p:sld>`);
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<Relationship Target="../media/image1.png" Id="rId2"/>`
    );
    zip.file("ppt/media/image1.png", png);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const md = await documentToMarkdown("deck.pptx", bytes);
    expect(md).toContain("![image][img-");
    expect(md).toContain("data:image/png;base64,");
  });

  it("refuses a file whose bytes do not match its extension", async () => {
    await expect(documentToMarkdown("notes.pdf", new TextEncoder().encode("not a pdf"))).rejects.toThrow("not a pdf");
    await expect(documentToMarkdown("notes.docx", new Uint8Array([1, 2, 3, 4]))).rejects.toThrow("not a docx");
  });

  it("reads slide text from a pptx", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", `<p:sld><a:t>Quarter plan</a:t><a:t>Keep the scope small</a:t></p:sld>`);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const md = await documentToMarkdown("deck.pptx", bytes);
    expect(md).toContain("## Slide 1");
    expect(md).toContain("Quarter plan");
    expect(md).toContain("Keep the scope small");
  });
});

describe("docx HTML to Markdown", () => {
  it("keeps bold, italic, nested and numbered lists, quotes, and entities", () => {
    const md = htmlToMarkdown(
      "<h2>Plan</h2><p>Use <strong>two </strong>words &amp; <em>one</em> &#233;.</p>" +
        "<ul><li>Top<ul><li>Child</li></ul></li><li>Next</li></ul>" +
        "<ol><li>First</li><li>Second</li></ol><blockquote><p>Said</p></blockquote>"
    );
    expect(md).toContain("## Plan");
    expect(md).toContain("Use **two** words & *one* é.");
    expect(md).toContain("- Top\n  - Child\n- Next");
    expect(md).toContain("1. First\n2. Second");
    expect(md).toContain("> Said");
  });

  it("turns a table into a Markdown table", () => {
    const md = htmlToMarkdown(
      "<table><tr><th>Name</th><th>Qty</th></tr><tr><td>Pen | blue</td><td>2</td></tr></table>"
    );
    expect(md).toBe("| Name | Qty |\n| --- | --- |\n| Pen \\| blue | 2 |");
  });

  it("drops links with a script scheme and unknown tags", () => {
    const md = htmlToMarkdown('<p><a href="javascript:alert(1)">x</a><blink>y</blink></p>');
    expect(md).toBe("xy");
  });
});

describe("pptx structure", () => {
  const slide = `<p:sld><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Plan</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody>
      <a:p><a:r><a:t>Scope</a:t></a:r></a:p>
      <a:p><a:pPr lvl="1"/><a:r><a:t>Small</a:t></a:r></a:p>
    </p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>7</a:t></a:r></a:p></p:txBody></p:sp>
    <p:graphicFrame><a:tbl><a:tr><a:tc><a:p><a:r><a:t>A</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>B</a:t></a:r></a:p></a:tc></a:tr>
    <a:tr><a:tc><a:p><a:r><a:t>1</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>2</a:t></a:r></a:p></a:tc></a:tr></a:tbl></p:graphicFrame>
  </p:spTree></p:cSld></p:sld>`;
  const notes = `<p:notes><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Say hello</a:t></a:r></a:p></p:txBody></p:sp></p:notes>`;

  it("uses the title, bullet levels, tables, and notes, and skips the slide number", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", slide);
    zip.file("ppt/slides/_rels/slide1.xml.rels", `<Relationship Id="rId1" Target="../notesSlides/notesSlide1.xml"/>`);
    zip.file("ppt/notesSlides/notesSlide1.xml", notes);
    const md = await documentToMarkdown("deck.pptx", await zip.generateAsync({ type: "uint8array" }));
    expect(md).toBe(
      "## Slide 1: Plan\n\n- Scope\n  - Small\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> Notes: Say hello"
    );
  });
});

describe("matchDocumentNames", () => {
  it("matches documents by path, ignores markdown and folders, and honors the limit", () => {
    const entries = [
      { rel: "fin/Bilancio-2025.xlsx", isDirectory: false },
      { rel: "fin/bilancio.md", isDirectory: false },
      { rel: "bilancio.pdf", isDirectory: true },
      { rel: "a/bilancio.pdf", isDirectory: false }
    ];
    expect(matchDocumentNames(entries, " BILANCIO ", 5)).toEqual(["fin/Bilancio-2025.xlsx", "a/bilancio.pdf"]);
    expect(matchDocumentNames(entries, "bilancio", 1)).toEqual(["fin/Bilancio-2025.xlsx"]);
    expect(matchDocumentNames(entries, "", 5)).toEqual([]);
  });
});
