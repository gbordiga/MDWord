import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { documentToMarkdown, htmlToMarkdown } from "./documents";

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
