import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";
import { MYST_KNOWN_DIRECTIVES, MYST_KNOWN_ROLES } from "@mdword/shared";

describe("MyST spec harness", () => {
  it("parses core inline roles without unknown-directive noise", () => {
    const result = parseMarkdown("See {cite}`key`. Ref {ref}`lbl`. $x$");
    expect(result.diagnostics.some((d) => /unknown directive/i.test(d.message))).toBe(false);
    expect(MYST_KNOWN_ROLES.has("cite")).toBe(true);
    expect(MYST_KNOWN_ROLES.has("ref")).toBe(true);
  });

  it("parses list-table directive into inner table AST", () => {
    const result = parseMarkdown(`:::{list-table} Cap
:widths: 1 2

* - a
  - b
:::`);
    const dir = result.ast.children?.[0];
    expect(dir?.type).toBe("mystDirective");
    expect(dir?.name).toBe("list-table");
    expect(MYST_KNOWN_DIRECTIVES.has("csv-table")).toBe(true);
    const table = dir?.children?.[0]?.children?.find((c) => c.type === "table");
    expect(table).toBeTruthy();
  });
});
