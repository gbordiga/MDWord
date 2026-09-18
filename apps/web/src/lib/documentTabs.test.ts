import { describe, expect, it } from "vitest";
import { findTabByPath, neighborTabId, tabTitle } from "./documentTabs";
import type { DocumentTab } from "./documentTabs";

function tab(id: string, path: string | null, title = "Doc"): DocumentTab {
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
    dirty: false,
    lastSavedAt: null,
    lastSavedContent: "",
    historyKey: "k",
    syncGeneration: 0,
    sourceGeneration: 0,
    editGeneration: 0
  };
}

describe("documentTabs", () => {
  it("finds tabs by normalized path", () => {
    const tabs = [tab("1", "Folder/A.md"), tab("2", "Folder/B.md")];
    expect(findTabByPath(tabs, "Folder\\A.md")?.path).toBe("Folder/A.md");
  });

  it("picks a neighbor when closing a tab", () => {
    const tabs = [tab("1", "a.md"), tab("2", "b.md"), tab("3", "c.md")];
    expect(neighborTabId(tabs, "2")).toBe("3");
    expect(neighborTabId(tabs, "3")).toBe("2");
  });

  it("uses frontmatter title for tab label", () => {
    expect(tabTitle(tab("x", null, "My note"))).toBe("My note");
  });
});
