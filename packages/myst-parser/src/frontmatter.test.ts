import { describe, expect, it } from "vitest";
import { extractFrontmatter, yamlToPlain } from "./frontmatter";

describe("frontmatter", () => {
  it("keeps recoverable keys when YAML reports errors", () => {
    const source = `---
titolo: Direzione strategica
title: [unterminated
---

# Body
`;
    const extracted = extractFrontmatter(source);
    expect(extracted.hasFrontmatter).toBe(true);
    expect(extracted.diagnostics.length).toBeGreaterThan(0);
    const plain = yamlToPlain(extracted.yaml);
    expect(plain.titolo).toBe("Direzione strategica");
  });
});
