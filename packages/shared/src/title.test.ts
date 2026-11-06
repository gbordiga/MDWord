import { describe, expect, it } from "vitest";
import {
  displayDocumentTitle,
  documentDate,
  documentTitle,
  documentTitleKey,
  sanitizeExportFileName,
  suggestedPdfFileName,
  titleFromPath
} from "./title";

describe("document titles", () => {
  it("prefers title, then titolo", () => {
    expect(documentTitle({ title: "English" })).toBe("English");
    expect(documentTitle({ titolo: "Direzione strategica" })).toBe("Direzione strategica");
    expect(documentTitle({ name: "Nome" })).toBe("Nome");
    expect(documentTitle({})).toBe("Untitled");
    expect(documentTitleKey({ titolo: "X" })).toBe("titolo");
    expect(documentTitleKey({ title: "A", titolo: "B" })).toBe("title");
  });

  it("falls back to the file stem", () => {
    expect(titleFromPath("docs/IPR001 - Direzione.md")).toBe("IPR001 - Direzione");
    expect(displayDocumentTitle({ titolo: "Direzione strategica" }, "x.md")).toBe(
      "Direzione strategica"
    );
    expect(displayDocumentTitle({}, "notes/alpha.md")).toBe("alpha");
  });

  it("builds a PDF file name from the document title", () => {
    expect(sanitizeExportFileName("Audit report")).toBe("Audit report");
    expect(sanitizeExportFileName('Q3 / "draft": v2')).toBe("Q3 draft v2");
    expect(sanitizeExportFileName("...")).toBe("document");
    expect(sanitizeExportFileName("  report. . . ")).toBe("report");
    expect(sanitizeExportFileName("report..." + " ".repeat(40))).toBe("report");
    expect(suggestedPdfFileName({ title: "Audit report" }, "x.md")).toBe("Audit report.pdf");
    expect(suggestedPdfFileName({}, "notes/alpha.md")).toBe("alpha.pdf");
  });

  it("strips a long tail without backtracking", () => {
    const started = Date.now();
    // A run that does not reach the end is the shape that makes `[. ]+$` quadratic.
    expect(sanitizeExportFileName(`report${".".repeat(100_000)}x`)).toBe("report");
    expect(sanitizeExportFileName(`${" ".repeat(100_000)}report`)).toBe("report");
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("document dates", () => {
  it("keeps ISO calendar days and YAML Date objects", () => {
    expect(documentDate({ date: "2026-03-15" })).toBe("2026-03-15");
    expect(documentDate({ date: new Date("2026-03-15T00:00:00.000Z") })).toBe("2026-03-15");
    expect(documentDate({ data: "2026-09-06" })).toBe("2026-09-06");
    expect(documentDate({})).toBe("");
    expect(documentDate({ date: "2026" })).toBe("2026");
    expect(documentDate({ date: "2026-03" })).toBe("2026-03");
  });
});
