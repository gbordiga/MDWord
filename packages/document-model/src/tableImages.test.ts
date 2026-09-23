import { describe, expect, it } from "vitest";
import { imageReference, type GenericNode } from "@mdword/shared";
import { parseMarkdown } from "@mdword/myst-parser";
import { serializeMarkdown, serializeMarkdownFragment } from "@mdword/markdown-serializer";
import { astToTiptap, visualProjection } from "../../editor/src/astToTiptap";
import { tiptapToAst } from "../../editor/src/tiptapToAst";
import { applyVisualDocument, openDocument, saveDocument } from "./index";

const JPEG = `data:image/jpeg;base64,/9j/${"B".repeat(200)}`;
const JPEG_LARGE = `data:image/jpeg;base64,/9j/${"B".repeat(8000)}`;

function tableSource(alt = "21f35c13-f134-493f-99fd-93d6eb7b2ca6"): string {
  const ref = imageReference(alt, JPEG);
  return `| ${ref.image} | ![][${ref.id}] | ![][${ref.id}] |
| --- | --- | --- |
|  |  |  |
|  |  |  |

${ref.definition}
`;
}

describe("table cell images", () => {
  it("parses a 3-column photo header as one table", () => {
    const source = tableSource();
    const parsed = parseMarkdown(source);
    const types = (parsed.ast.children ?? []).map((node) => node.type);
    expect(types[0]).toBe("table");
    expect(types.filter((type) => type === "table")).toHaveLength(1);
    const table = parsed.ast.children?.[0];
    expect(table?.children?.[0]?.children?.length).toBe(3);
  });

  it("open + save keeps the table bytes", () => {
    const source = tableSource();
    expect(saveDocument(openDocument(source))).toBe(source);
  });

  it("serialize does not pull the first cell image out of the table", () => {
    const source = tableSource();
    const out = serializeMarkdown({ ast: parseMarkdown(source).ast });
    const lines = out.split("\n").filter((line) => line.trim());
    expect(lines[0]).toMatch(/^\|/);
    expect(out.match(/^\|/gm)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(out.startsWith("![")).toBe(false);
  });

  it("visual no-op does not duplicate the table or leak stubs", () => {
    const source = tableSource();
    const model = openDocument(source);
    const projection = visualProjection(model.ast);
    const next = applyVisualDocument(model, projection.ast, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(next.source).toBe(source);
    expect(next.source).not.toContain("MDWORDIMG");
  });

  it("applying the live TipTap tree does not duplicate the table", () => {
    const source = tableSource();
    const model = openDocument(source);
    const projection = visualProjection(model.ast);
    const live = tiptapToAst(astToTiptap(model.ast));
    const next = applyVisualDocument(model, live, {
      previous: projection.ast,
      origins: projection.origins
    });
    const tables = parseMarkdown(next.source).ast.children?.filter((node) => node.type === "table") ?? [];
    expect(tables).toHaveLength(1);
    expect((next.source.match(/data:image\//g) ?? []).length).toBe(1);
    expect((next.source.match(/^\[img-/gm) ?? []).length).toBe(1);
    expect(next.source).not.toContain("MDWORDIMG");
  });

  it("does not split a large shared photo header into two tables", () => {
    const ref = imageReference("21f35c13-f134-493f-99fd-93d6eb7b2ca6", JPEG_LARGE);
    const source = `| ${ref.image} | ![][${ref.id}] | ![][${ref.id}] |
| ------------------------------------- | ------------------------------------- | ------------------------------------- |
|                                       |                                       |                                       |
|                                       |                                       |                                       |

${ref.definition}
`;
    const model = openDocument(source);
    const projection = visualProjection(model.ast);
    const live = tiptapToAst(astToTiptap(model.ast));
    const next = applyVisualDocument(model, live, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(parseMarkdown(next.source).ast.children?.filter((node) => node.type === "table")).toHaveLength(1);
    expect((next.source.match(/^\[img-/gm) ?? []).length).toBe(1);
  });

  it("keeps one data:image definition when three cells share a photo", () => {
    const source = tableSource();
    const parsed = parseMarkdown(source);
    const out = serializeMarkdown({ ast: parsed.ast });
    expect((out.match(/data:image\//g) ?? []).length).toBe(1);
    expect((out.match(/^\[img-/gm) ?? []).length).toBe(1);
    const table = parsed.ast.children?.find((node) => node.type === "table");
    const fragment = serializeMarkdownFragment(table ? [table] : []);
    expect(fragment).toMatch(/^\|/);
    expect(fragment).toContain("data:image/");
    expect((fragment.match(/data:image\//g) ?? []).length).toBe(1);
  });

  it("keeps a figure above a 3-cell table that shares the same photo", () => {
    const ref = imageReference("21f35c13-f134-493f-99fd-93d6eb7b2ca6", JPEG);
    const source = `${ref.image}

| ![][${ref.id}] | ![][${ref.id}] | ![][${ref.id}] |
| --- | --- | --- |
|  |  |  |
|  |  |  |

${ref.definition}
`;
    const model = openDocument(source);
    expect(saveDocument(model)).toBe(source);
    const types = (model.ast.children ?? []).map((node) => node.type);
    expect(types[0]).toMatch(/image|container|paragraph/);
    expect(types.filter((type) => type === "table")).toHaveLength(1);
    expect((model.source.match(/data:image\//g) ?? []).length).toBe(1);

    const projection = visualProjection(model.ast);
    const live = tiptapToAst(astToTiptap(model.ast));
    const next = applyVisualDocument(model, live, {
      previous: projection.ast,
      origins: projection.origins
    });
    const nextTypes = (parseMarkdown(next.source).ast.children ?? []).map((node) => node.type);
    expect(nextTypes.filter((type) => type === "table")).toHaveLength(1);
    expect(next.source.trimStart().startsWith("![")).toBe(true);
    expect(next.source).toContain(`| ![][${ref.id}]`);
    expect((next.source.match(/data:image\//g) ?? []).length).toBe(1);
    expect(next.source.split("\n")[0]).not.toContain("|");
  });

  it("keeps a pasted image inside a MyST table directive", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseMarkdown(`:::{table} KPI

| A | B |
| --- | --- |
| x | y |
:::
`);
    const doc = astToTiptap(parsed.ast);
    const table = doc.content?.find((node) => node.type === "table");
    expect(table?.attrs?.sourceKind).toBe("table");
    const cell = table?.content?.[1]?.content?.[1];
    expect(cell?.type).toBe("tableCell");
    cell!.content = [
      {
        type: "figure",
        attrs: { src, alt: "pic", caption: "", width: 40, layout: "block-center", label: null }
      }
    ];
    const md = serializeMarkdown({ ast: tiptapToAst(doc) });
    const directive = md.slice(md.indexOf(":::{table}"), md.indexOf("\n:::", md.indexOf(":::{table}")));
    expect(directive).toContain(":::{table} KPI");
    expect(directive).toContain(imageReference("pic", src).image);
    expect(directive).toContain("{width=40%}");
    expect(md).toContain(imageReference("pic", src).definition);
    const again = parseMarkdown(md);
    const saved = again.ast.children?.find((node) => node.type === "mystDirective" || node.type === "table");
    const inner =
      saved?.type === "table"
        ? saved
        : saved?.children?.find((node) => node.type === "container")?.children?.find((node) => node.type === "table") ??
          saved?.children?.find((node) => node.type === "table");
    const imageCell = inner?.children?.[1]?.children?.[1];
    const urls: string[] = [];
    const walk = (node: GenericNode | undefined) => {
      if (!node) return;
      if (node.type === "image" || node.type === "imageReference") urls.push(String(node.url ?? node.identifier ?? "ref"));
      node.children?.forEach(walk);
    };
    walk(imageCell);
    expect(urls.length).toBeGreaterThan(0);
  });

  it("writes a data:image definition when serializing an inserted photo", () => {
    const out = serializeMarkdown({
      ast: { type: "root", children: [{ type: "image", url: JPEG, alt: "pic" }] }
    });
    expect((out.match(/data:image\//g) ?? []).length).toBe(1);
    expect(out).toMatch(/^\[img-/m);
    expect(serializeMarkdownFragment([{ type: "image", url: JPEG, alt: "pic" }])).toContain("data:image/");
  });

  it("TipTap round-trip keeps one table with three header images", () => {
    const source = tableSource();
    const parsed = parseMarkdown(source);
    const json = astToTiptap(parsed.ast);
    expect(json.content?.map((node) => node.type)).toEqual(["table"]);
    const header = json.content?.[0]?.content?.[0];
    expect(header?.content?.length).toBe(3);
    expect(header?.content?.every((cell) => cell.content?.some((n) => n.type === "figure"))).toBe(true);
    const back = serializeMarkdown({ ast: tiptapToAst(json) });
    const reparsed = parseMarkdown(back);
    expect(reparsed.ast.children?.filter((node) => node.type === "table")).toHaveLength(1);
    expect(back.startsWith("![")).toBe(false);
    expect(back.split("\n")[0]).toMatch(/^\|/);
  });
});
