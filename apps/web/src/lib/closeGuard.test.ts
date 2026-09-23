import { describe, expect, it } from "vitest";
import { dirtyDocumentTitles, sessionIsDirty, unsavedCloseMessage } from "./closeGuard";
import type { DocumentTab } from "./documentTabs";

function tab(id: string, path: string | null, title: string, dirty = false): DocumentTab {
  return {
    id,
    path,
    model: {
      frontmatter: { title },
      ast: { type: "root", children: [] },
      source: "",
      body: "",
      head: false
    } as unknown as DocumentTab["model"],
    dirty,
    preview: false,
    lastSavedAt: null,
    lastSavedContent: "",
    syncGeneration: 0,
    sourceGeneration: 0,
    editGeneration: 0,
    documentUndo: { past: [], future: [], lastKind: null, lastAt: 0 }
  };
}

describe("close guard", () => {
  it("treats a background dirty tab as unsaved even when the active document is clean", () => {
    const tabs = [tab("active", "a.md", "A", false), tab("other", "b.md", "B", true)];
    expect(sessionIsDirty({ tabs, activeTabId: "active", dirty: false })).toBe(true);
    expect(dirtyDocumentTitles(tabs, "active", false)).toEqual(["B"]);
  });

  it("trusts the live dirty flag for the active tab", () => {
    const tabs = [tab("active", "a.md", "A", false)];
    expect(sessionIsDirty({ tabs, activeTabId: "active", dirty: true })).toBe(true);
    expect(sessionIsDirty({ tabs, activeTabId: "active", dirty: false })).toBe(false);
  });

  it("names every dirty document in the close prompt", () => {
    expect(unsavedCloseMessage(["Report"])).toContain("Report");
    expect(unsavedCloseMessage(["Report"])).toContain("stays open");
    expect(unsavedCloseMessage(["Report", "Notes"])).toContain("2 documents");
  });
});
