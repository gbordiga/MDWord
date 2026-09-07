import { describe, expect, it } from "vitest";
import {
  addFrontmatterKey,
  listCustomFrontmatterKeys,
  listFrontmatterKeys,
  openDocument,
  removeFrontmatterKey,
  renameFrontmatterKey,
  saveDocument,
  setFrontmatterValues
} from "./index";

const SOURCE = `---
codice: IPR001
titolo: Direzione strategica
aziende: [gruppo]
processo: null
mdoc:
  version: 1
---

# Body
`;

describe("frontmatter edit", () => {
  it("lists YAML keys in order and hides mdoc", () => {
    const model = openDocument(SOURCE);
    expect(listFrontmatterKeys(model)).toEqual(["codice", "titolo", "aziende", "processo"]);
    expect(listCustomFrontmatterKeys(model)).toEqual(["codice", "aziende", "processo"]);
  });

  it("updates a custom scalar without dropping other keys", () => {
    const next = setFrontmatterValues(openDocument(SOURCE), { codice: "IPR002" });
    expect(next.frontmatter.codice).toBe("IPR002");
    expect(next.frontmatter.titolo).toBe("Direzione strategica");
    expect(saveDocument(next)).toMatch(/codice:\s*IPR002/);
  });

  it("writes list values as YAML sequences", () => {
    const next = setFrontmatterValues(openDocument(SOURCE), { iso9001: ["4.1", "4.2"] });
    expect(next.frontmatter.iso9001).toEqual(["4.1", "4.2"]);
    expect(saveDocument(next)).toMatch(/iso9001:/);
    expect(saveDocument(next)).toContain("4.1");
  });

  it("removes and renames keys", () => {
    const removed = removeFrontmatterKey(openDocument(SOURCE), "aziende");
    expect(listFrontmatterKeys(removed)).not.toContain("aziende");
    const renamed = renameFrontmatterKey(removed, "titolo", "title");
    expect(renamed.frontmatter.title).toBe("Direzione strategica");
    expect(renamed.frontmatter.titolo).toBeUndefined();
    expect(saveDocument(renamed)).not.toMatch(/^titolo:/m);
  });

  it("adds a missing custom key", () => {
    const next = addFrontmatterKey(openDocument(SOURCE), "owner", "string");
    expect(listFrontmatterKeys(next)).toContain("owner");
    expect(next.frontmatter.owner).toBe("");
  });
});
