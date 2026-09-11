import { describe, expect, it } from "vitest";
import { imageReference } from "@mdword/shared";
import { serializeMarkdown } from "./serialize";
import { parseMarkdown } from "@mdword/myst-parser";

function expectEmbedded(md: string, alt: string, src: string) {
  const ref = imageReference(alt, src);
  expect(md).toContain(ref.image);
  expect(md).toContain(ref.definition);
  expect(md).not.toContain("```{image}");
  expect(md).not.toMatch(/:::\{?figure\}?\s+data:/);
}

describe("golden serialize", () => {
  it("keeps colon figure fences when reserializing a parsed document", () => {
    const source = `:::{figure} ./images/pump.png
:label: fig-pump
:width: 40%

Schema della pompa.
:::
`;
    const out = serializeMarkdown({ ast: parseMarkdown(source).ast });
    expect(out).toContain(":::{figure} ./images/pump.png");
    expect(out).toMatch(/:(?:label|name):\s*fig-pump/);
    expect(out).toMatch(/:width:\s*40%/);
    expect(out).toContain("Schema della pompa.");
    expect(out).not.toMatch(/```\{figure\}/);
  });

  it("emits a heading and paragraph", () => {
    const parsed = parseMarkdown("# Title\n\nHello.\n");
    const out = serializeMarkdown({ ast: parsed.ast, yaml: parsed.yaml });
    expect(out).toMatch(/# Title/);
    expect(out).toMatch(/Hello/);
  });

  it("emits wikilinks not the internal scheme", () => {
    const parsed = parseMarkdown("See [[Doc]].\n");
    const out = serializeMarkdown({ ast: parsed.ast, yaml: parsed.yaml });
    expect(out).toContain("[[Doc]]");
    expect(out).not.toContain("mdoc-wiki:");
  });

  it("rewrites a leftover table {image} fence to one-line markdown", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseMarkdown(`| a | b |
| - | --- |
| x | \`\`\`{image} ${src}
:alt: pic
\`\`\` |
`);
    const out = serializeMarkdown({ ast: parsed.ast });
    expectEmbedded(out, "pic", src);
    expect(out).not.toContain("{image}");
  });

  it("keeps a table data-URL image on one markdown line", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseMarkdown(`| a | b |
| --- | --- |
| x | ![pic](${src}) |
`);
    const out = serializeMarkdown({ ast: parsed.ast });
    expectEmbedded(out, "pic", src);
    expect(out).not.toContain("{image}");
    expect(out).not.toMatch(/```/);
    expect(out.split("\n").some((line) => line.includes("![pic]") && line.includes("|"))).toBe(true);
  });

  it("keeps a long table photo as one-line markdown, not a {image} fence", () => {
    const src = `data:image/png;base64,${"A".repeat(2400)}`;
    const out = serializeMarkdown({
      ast: {
        type: "root",
        children: [
          {
            type: "table",
            children: [
              {
                type: "tableRow",
                children: [
                  { type: "tableCell", header: true, children: [{ type: "text", value: "a" }] },
                  { type: "tableCell", header: true, children: [{ type: "text", value: "b" }] }
                ]
              },
              {
                type: "tableRow",
                children: [
                  { type: "tableCell", children: [{ type: "text", value: "x" }] },
                  { type: "tableCell", children: [{ type: "image", url: src, alt: "pic" }] }
                ]
              }
            ]
          }
        ]
      }
    });
    expectEmbedded(out, "pic", src);
    expect(out).not.toContain("{image}");
    expect(out).not.toMatch(/```/);
    const back = parseMarkdown(out);
    expect(JSON.stringify(back.ast)).toContain(src);
    expect(JSON.stringify(back.ast)).not.toContain("{image}");
  });

  it("keeps table image width on one markdown line", () => {
    const src = `data:image/png;base64,${"A".repeat(80)}`;
    const out = serializeMarkdown({
      ast: {
        type: "root",
        children: [
          {
            type: "table",
            children: [
              {
                type: "tableRow",
                children: [
                  { type: "tableCell", header: true, children: [{ type: "text", value: "a" }] },
                  { type: "tableCell", header: true, children: [{ type: "text", value: "b" }] }
                ]
              },
              {
                type: "tableRow",
                children: [
                  { type: "tableCell", children: [{ type: "text", value: "x" }] },
                  { type: "tableCell", children: [{ type: "image", url: src, alt: "pic", title: "width=60%" }] }
                ]
              }
            ]
          }
        ]
      }
    });
    const ref = imageReference("pic", src);
    expect(out).toContain(`${ref.image}{width=60%}`);
    expect(out).toContain(ref.definition);
    expect(out).not.toContain("{image}");
  });

  it("flattens a table cell that only has an imageReference", () => {
    const src = `data:image/png;base64,${"B".repeat(80)}`;
    const out = serializeMarkdown({
      ast: {
        type: "root",
        children: [
          {
            type: "table",
            children: [
              {
                type: "tableRow",
                children: [
                  {
                    type: "tableCell",
                    children: [
                      {
                        type: "paragraph",
                        children: [{ type: "imageReference", identifier: "img-x", label: "img-x", alt: "pic" }]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          { type: "definition", identifier: "img-x", label: "img-x", url: src }
        ]
      }
    });
    const ref = imageReference("pic", src);
    expect(out).toContain(ref.image);
    expect(out).toContain(ref.definition);
    expect(out).not.toContain("{image}");
  });

  it("does not save a sized data-URL photo as a {image} fence", () => {
    const src = `data:image/png;base64,${"iVBORw0KGgoAAAANSU"}${"A".repeat(200)}`;
    const out = serializeMarkdown({
      ast: { type: "root", children: [{ type: "image", url: src, alt: "pic", width: "60%" }] }
    });
    expectEmbedded(out, "pic", src);
    expect(out).toMatch(/:width:\s*60%/);
    expect(out).toContain(":::{figure}");
    expect(out).not.toMatch(/:::\{figure\} data:/);
    const json = JSON.stringify(parseMarkdown(out).ast);
    expect(json).toContain(src);
    expect(json).not.toContain("```{image}");
    expect(json).not.toContain(":::figure");
  });

  it("leaves on-disk image paths inline and does not invent a data-URL definition", () => {
    const out = serializeMarkdown({
      ast: { type: "root", children: [{ type: "image", url: "./images/demo.png", alt: "Alt text" }] }
    });
    expect(out).toContain("![Alt text](./images/demo.png)");
    expect(out).not.toContain("data:image/");
    expect(out).not.toMatch(/^\[img-/m);
  });

  it("serializes a figure that only has an imageReference child", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect(() =>
      serializeMarkdown({
        ast: {
          type: "root",
          children: [
            {
              type: "container",
              kind: "figure",
              children: [{ type: "imageReference", identifier: "img-x", label: "img-x", alt: "pic" }]
            },
            { type: "definition", identifier: "img-x", label: "img-x", url: src }
          ]
        }
      })
    ).not.toThrow();
    const out = serializeMarkdown({
      ast: {
        type: "root",
        children: [
          {
            type: "container",
            kind: "figure",
            children: [{ type: "imageReference", identifier: "img-x", label: "img-x", alt: "pic" }]
          },
          { type: "definition", identifier: "img-x", label: "img-x", url: src }
        ]
      }
    });
    expectEmbedded(out, "pic", src);
  });
});
