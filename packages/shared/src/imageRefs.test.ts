import { describe, expect, it } from "vitest";
import { imageRefId, imageReference, rewriteEmbeddedImagesToReferences } from "./imageRefs";

const PNG = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
const JPEG = `data:image/jpeg;base64,/9j/${"A".repeat(80)}`;

describe("imageRefs", () => {
  it("uses a stable content-addressed label", () => {
    expect(imageRefId(PNG)).toMatch(/^img-[0-9a-f]+$/);
    expect(imageRefId(PNG)).toBe(imageRefId(`  ${PNG}  `));
  });

  it("rewrites a short data URL the same way as a long photo", () => {
    const src = "data:image/png;base64,AAAA";
    const out = rewriteEmbeddedImagesToReferences(`![dot](${src})\n`);
    const ref = imageReference("dot", src);
    expect(out).toContain(ref.image);
    expect(out).toContain(ref.definition);
    expect(out).not.toContain(`![dot](${src})`);
  });

  it("rewrites inline data URLs to CommonMark references at the end", () => {
    const out = rewriteEmbeddedImagesToReferences(`# Title\n\n![pic](${JPEG})\n`);
    const ref = imageReference("pic", JPEG);
    expect(out).toContain(`# Title`);
    expect(out).toContain(ref.image);
    expect(out).toContain(ref.definition);
    expect(out.indexOf(ref.image)).toBeLessThan(out.indexOf(ref.definition));
    expect(out.slice(0, out.indexOf(ref.definition))).not.toContain("data:image/");
  });

  it("keeps a table cell short and moves the payload to the definition", () => {
    const out = rewriteEmbeddedImagesToReferences(`| a | ![pic](${JPEG}) |\n`);
    const ref = imageReference("pic", JPEG);
    expect(out).toContain(`| a | ${ref.image} |`);
    expect(out).toContain(ref.definition);
    expect(out.split("\n").some((line) => line.includes(JPEG) && line.includes("|"))).toBe(false);
  });

  it("keeps table image width on the reference", () => {
    const out = rewriteEmbeddedImagesToReferences(`| a | ![pic](${JPEG} "width=60%") |\n`);
    const ref = imageReference("pic", JPEG);
    expect(out).toContain(`| a | ${ref.image}{width=60%} |`);
    expect(out).toContain(ref.definition);
  });

  it("dedupes the same payload and drops unused definitions", () => {
    const first = imageReference("one", JPEG);
    const out = rewriteEmbeddedImagesToReferences(
      `${first.image}\n\n![two](${JPEG})\n\n[orphan]: ${PNG}\n`
    );
    expect(out.match(new RegExp(first.id, "g"))?.length).toBeGreaterThan(2);
    expect(out).toContain(first.definition);
    expect(out).not.toContain(PNG);
    expect(out).not.toContain("[orphan]");
  });

  it("renames a legacy label to the content-addressed id", () => {
    const out = rewriteEmbeddedImagesToReferences(`![pic][foto]\n\n[foto]: ${JPEG}\n`);
    const ref = imageReference("pic", JPEG);
    expect(out).toContain(ref.image);
    expect(out).toContain(ref.definition);
    expect(out).not.toContain("[foto]");
  });

  it("keeps the caption on the image alt, not on the definition", () => {
    const out = rewriteEmbeddedImagesToReferences(`![Schema della pompa](${JPEG})\n`);
    const ref = imageReference("Schema della pompa", JPEG);
    expect(out).toContain(ref.image);
    expect(out).toContain(ref.definition);
    expect(out).not.toMatch(/\[img-[^\]]+\]: data:image\/[^\n]+ "/);
  });
});
