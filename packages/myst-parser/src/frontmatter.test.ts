import { describe, expect, it } from "vitest";
import { extractFrontmatter, splitMarkdownSource, yamlToPlain } from "./frontmatter";

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

  it("splits head and body without dropping bytes", () => {
    const source = `---
title: Hello
---

# Body
`;
    const { head, rest } = splitMarkdownSource(source);
    expect(head + rest).toBe(source);
    expect(head.startsWith("---\n")).toBe(true);
    expect(head.endsWith("---\n")).toBe(true);
    expect(rest).toBe("\n# Body\n");
  });
});
