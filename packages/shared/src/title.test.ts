import { describe, expect, it } from "vitest";
import {
  displayDocumentTitle,
  documentTitle,
  documentTitleKey,
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
});
