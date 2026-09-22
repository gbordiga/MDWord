import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { astToTiptap } from "../../editor/src/astToTiptap";
import { tiptapToAst } from "../../editor/src/tiptapToAst";
import { visualProjection } from "../../editor/src/astToTiptap";
import {
  applyVisualDocument,
  openDocument,
  saveDocument,
  setFrontmatterValues
} from "./index";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/round-trip"
);

const SOURCE = `---
title: Keep me
tags:
  - a
  # keep this comment
mdoc:
  version: 1
---

# Heading

Unchanged paragraph with  extra   spaces.

## Later

- one
- two
`;

describe("markdown source of truth", () => {
  it("open + save is byte-identical", () => {
    const source = readFileSync(path.join(fixturesDir, "basic.md"), "utf8");
    expect(saveDocument(openDocument(source))).toBe(source);
    expect(saveDocument(openDocument(SOURCE))).toBe(SOURCE);
  });

  it.each(readdirSync(fixturesDir).filter((file) => file.endsWith(".md")))(
    "preserves fixture bytes for %s",
    (file: string) => {
      const source = readFileSync(path.join(fixturesDir, file), "utf8");
      expect(saveDocument(openDocument(source))).toBe(source);
    }
  );

  it("YAML-only edits keep the body bytes", () => {
    const model = openDocument(SOURCE);
    const next = setFrontmatterValues(model, { title: "Changed" });
    expect(next.body).toBe(model.body);
    expect(next.source.endsWith(model.body)).toBe(true);
    expect(next.source).toMatch(/title:\s*Changed/);
    expect(next.source).toContain("Unchanged paragraph with  extra   spaces.");
    expect(next.source).toContain("# keep this comment");
  });

  it("a visual no-op does not rewrite the file", () => {
    const model = openDocument(SOURCE);
    const projection = visualProjection(model.ast);
    const next = applyVisualDocument(model, projection.ast, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(next.source).toBe(SOURCE);
  });

  it("editing one heading leaves the later paragraph untouched", () => {
    const model = openDocument(SOURCE);
    const projection = visualProjection(model.ast);
    const visual = structuredClone(projection.ast);
    const heading = visual.children?.[0];
    expect(heading?.type).toBe("heading");
    if (heading) heading.children = [{ type: "text", value: "New heading" }];
    const next = applyVisualDocument(model, visual, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(next.source).toContain("# New heading");
    expect(next.source).toContain("Unchanged paragraph with  extra   spaces.");
    expect(next.source).toContain("## Later");
    expect(next.source).toContain("- one");
    expect(next.body).toContain("Unchanged paragraph with  extra   spaces.");
  });

  it("source edits keep the typed markdown", () => {
    const typed = `${SOURCE}\nExtra line from source.\n`;
    expect(openDocument(typed).source).toBe(typed);
    expect(saveDocument(openDocument(typed))).toBe(typed);
  });

  it("inserting a visual paragraph keeps the existing heading text", () => {
    const model = openDocument(SOURCE);
    const projection = visualProjection(model.ast);
    const visual = structuredClone(projection.ast);
    visual.children = [
      { type: "paragraph", children: [{ type: "text", value: "Inserted" }] },
      ...(visual.children ?? [])
    ];
    const next = applyVisualDocument(model, visual, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(next.source).toContain("Inserted");
    expect(next.source).toContain("# Heading");
    expect(next.source).toContain("Unchanged paragraph with  extra   spaces.");
  });

  it("TipTap projection still maps a heading edit", () => {
    const model = openDocument(SOURCE);
    const json = astToTiptap(model.ast);
    const first = json.content?.[0];
    expect(first?.type).toBe("heading");
    if (first) first.content = [{ type: "text", text: "From TipTap" }];
    const nextAst = tiptapToAst(json);
    const projection = visualProjection(model.ast);
    const next = applyVisualDocument(model, nextAst, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(next.source).toContain("From TipTap");
    expect(next.source).toContain("Unchanged paragraph with  extra   spaces.");
  });

  it("persists MyST table :align: from visual attributes", () => {
    const model = openDocument("| A | B |\n| --- | --- |\n| 1 | 2 |\n");
    const json = astToTiptap(model.ast);
    const table = json.content?.find((node) => node.type === "table");
    expect(table).toBeTruthy();
    table!.attrs = { ...table!.attrs, align: "center", sourceKind: "table" };
    const nextAst = tiptapToAst(json);
    const projection = visualProjection(model.ast);
    const next = applyVisualDocument(model, nextAst, {
      previous: projection.ast,
      origins: projection.origins
    });
    expect(next.source).toContain(":align: center");
  });
});
