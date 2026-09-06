import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openDocument } from "@mdword/document-model";
import { astToTiptap } from "./astToTiptap";
import { collectEmptyTextPaths, tiptapDocFromJson } from "./schemaValid";

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/real-world/ipr001.md"
);

describe("real-world process document", () => {
  it("loads IPR001 into a valid ProseMirror document", () => {
    const source = readFileSync(fixture, "utf8");
    const model = openDocument(source);
    expect(model.frontmatter.titolo).toBe("Direzione strategica");
    const json = astToTiptap(model.ast);
    expect(collectEmptyTextPaths(json)).toEqual([]);
    const doc = tiptapDocFromJson(json);
    expect(doc.childCount).toBeGreaterThan(0);
    expect(doc.textContent).toContain("Direzione strategica");
    expect(doc.textContent).toContain("Process Owner");
  });
});
