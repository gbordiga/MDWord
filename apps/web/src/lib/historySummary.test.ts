import { describe, expect, it } from "vitest";
import { summarizeHistoryChanges } from "./historySummary";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const BASE = `---
title: "Alpha"
mdoc:
  version: 1
  margins:
    top: 20mm
    right: 20mm
    bottom: 20mm
    left: 25mm
---

# Alpha

Hello.
`;

describe("summarizeHistoryChanges", () => {
  it("summarizes a title change without dumping YAML", () => {
    const next = BASE.replace('title: "Alpha"', 'title: "Beta"').replace("# Alpha", "# Beta");
    const summary = summarizeHistoryChanges(BASE, next);
    expect(summary.facts.some((fact) => fact.startsWith("Title: Alpha → Beta"))).toBe(true);
    expect(summary.facts.join("\n")).not.toContain("mdoc:");
    expect(summary.facts.join("\n")).not.toContain("version:");
  });

  it("counts changed paragraphs", () => {
    const summary = summarizeHistoryChanges(BASE, BASE.replace("Hello.", "Hello world.\n\nSecond."));
    expect(summary.facts.some((fact) => /paragraph/.test(fact))).toBe(true);
    expect(summary.facts.join("\n")).toMatch(/Hello world|Second/);
  });

  it("reports a table row addition", () => {
    const before = `${BASE}
| A | B |
| --- | --- |
| 1 | 2 |
`;
    const after = `${BASE}
| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
`;
    const summary = summarizeHistoryChanges(before, after);
    expect(summary.facts.some((fact) => /Table 1: 1 row added/.test(fact))).toBe(true);
  });

  it("summarizes page property edits instead of raw YAML", () => {
    const next = BASE.replace("left: 25mm", "left: 40mm");
    const summary = summarizeHistoryChanges(BASE, next);
    expect(summary.facts).toContain("Page properties: margins");
    expect(summary.facts.join("\n")).not.toContain("40mm");
    expect(summary.facts.join("\n")).not.toMatch(/^[-+] /m);
  });

  it("describes imported embeds without base64", () => {
    const before = `${BASE}\n![cat](./cat.png)\n`;
    const after = `${BASE}\n![cat](${PNG})\n`;
    const summary = summarizeHistoryChanges(before, after);
    expect(summary.facts.some((fact) => /image/.test(fact) && /payload hidden/.test(fact))).toBe(true);
    expect(summary.facts.join("\n")).not.toContain("data:image");
    expect(summary.facts.join("\n")).not.toContain("base64");
    expect(summary.facts.join("\n")).not.toContain(PNG.slice(0, 30));
  });

  it("names a newly typed heading", () => {
    const summary = summarizeHistoryChanges("# \n\n", "# Hello token\n\n");
    expect(summary.facts.join("\n")).toMatch(/heading added: Hello token|Title:.*Hello token/);
  });

  it("keeps added/removed counts as metadata", () => {
    const summary = summarizeHistoryChanges("a\n", "a\nb\n");
    expect(summary.added).toBeGreaterThan(0);
  });
});
