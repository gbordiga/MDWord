import { describe, expect, it } from "vitest";
import { createDataUrlStubber, foldPreview, rewriteEmbeddedImageFences, stubToken } from "./dataUrl";

describe("createDataUrlStubber", () => {
  it("replaces long data URLs in a tree and restores them in markdown", () => {
    const src = `data:image/png;base64,${"C".repeat(80)}`;
    const tree = {
      type: "image",
      url: src,
      alt: "pic"
    };
    const stubber = createDataUrlStubber();
    stubber.stubTree(tree);
    expect(tree.url).toBe(stubToken(0));
    expect(tree.url).not.toContain("CCCC");
    expect(stubber.restore(`![pic](${tree.url})`)).toBe(`![pic](${src})`);
  });

  it("rewrites leftover MyST image fences with data URLs to one-line markdown", () => {
    const src = `data:image/jpeg;base64,/9j/${"A".repeat(80)}`;
    expect(rewriteEmbeddedImageFences(`:::{figure} ${src}\n:alt: foto\n\n:::\n`)).toBe(`![foto](${src})\n`);
    expect(rewriteEmbeddedImageFences(`\`\`\`{image} ${src}\n:alt: pic\n\`\`\``)).toBe(`![pic](${src})`);
  });

  it("keeps width and caption when rewriting a data-URL figure fence", () => {
    const src = `data:image/jpeg;base64,/9j/${"A".repeat(80)}`;
    const out = rewriteEmbeddedImageFences(`:::{figure} ${src}\n:alt: foto\n:width: 40%\n\nSchema.\n:::\n`);
    expect(out).toContain(":::{figure}");
    expect(out).toContain(":width: 40%");
    expect(out).toContain(`![foto](${src})`);
    expect(out).toContain("Schema.");
    expect(out).not.toMatch(/:::\{figure\} data:/);
  });

  it("labels a folded payload for expand or collapse", () => {
    const src = `data:image/jpeg;base64,/9j/${"A".repeat(80)}`;
    expect(foldPreview(src)).toContain("click to expand");
    expect(foldPreview(src, "collapse")).toContain("click to collapse");
  });
});
