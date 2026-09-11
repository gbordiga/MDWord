import { describe, expect, it } from "vitest";
import { NEW_DOCUMENT_MDOC } from "@mdword/layout-engine";
import { untitledDocument } from "./untitled";

describe("untitledDocument", () => {
  it("writes every base layout field so a new file is not implicit", () => {
    const source = untitledDocument(new Date("2026-09-10T12:00:00.000Z"));
    expect(source).toContain('title: "Untitled"');
    expect(source).toContain("date: 2026-09-10");
    expect(source).toContain("language: it");
    expect(source).toContain("version: 1");
    expect(source).toContain("size: A4");
    expect(source).toContain("orientation: portrait");
    expect(source).toContain("top: 20mm");
    expect(source).toContain("left: 25mm");
    expect(source).toContain(`fontScale: ${NEW_DOCUMENT_MDOC.fontScale}`);
    expect(source).toContain('left: "{{title}}"');
    expect(source).toContain('right: "{{page}} / {{pages}}"');
    expect(source).toContain('right: "{{date}}"');
    expect(source).toContain("headings: false");
    expect(source).toContain("figures: true");
    expect(source).toContain("enabled: false");
    expect(source).toContain("depth: 3");
  });
});
