import { describe, expect, it } from "vitest";
import {
  commitOpenedWorkspaceTab,
  findTabByPath,
  neighborTabId,
  pinDocumentTab,
  resolveWorkspaceTabOpen,
  tabTitle
} from "./documentTabs";
import type { DocumentTab } from "./documentTabs";

function tab(
  id: string,
  path: string | null,
  title = "Doc",
  extras: Partial<Pick<DocumentTab, "preview" | "dirty">> = {}
): DocumentTab {
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
    dirty: extras.dirty ?? false,
    preview: extras.preview ?? false,
    lastSavedAt: null,
    lastSavedContent: "",
    historyKey: "k",
    syncGeneration: 0,
    sourceGeneration: 0,
    editGeneration: 0,
    documentUndo: { past: [], future: [], lastKind: null, lastAt: 0 }
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

  it("activates an already pinned tab without creating a preview", () => {
    const tabs = [tab("1", "a.md"), tab("2", "b.md")];
    const plan = resolveWorkspaceTabOpen(tabs, "b.md", "preview");
    expect(plan.existingId).toBe("2");
    expect(plan.replaceId).toBeNull();
    expect(plan.tabs).toEqual(tabs);
  });

  it("pins an existing preview on explicit pin", () => {
    const tabs = [tab("1", "a.md", "A", { preview: true })];
    const plan = resolveWorkspaceTabOpen(tabs, "a.md", "pinned");
    expect(plan.existingId).toBe("1");
    expect(plan.tabs[0]?.preview).toBe(false);
  });

  it("replaces a clean preview tab and keeps a single preview", () => {
    const tabs = [tab("pinned", "keep.md"), tab("preview", "a.md", "A", { preview: true })];
    const plan = resolveWorkspaceTabOpen(tabs, "b.md", "preview");
    expect(plan.existingId).toBeNull();
    expect(plan.replaceId).toBe("preview");
    const next = tab("next", "b.md", "B", { preview: true });
    const committed = commitOpenedWorkspaceTab(tabs, next, plan.replaceId);
    expect(committed.map((entry) => entry.id)).toEqual(["pinned", "next"]);
    expect(committed.filter((entry) => entry.preview)).toHaveLength(1);
  });

  it("does not replace a dirty preview tab", () => {
    const tabs = [tab("preview", "a.md", "A", { preview: true, dirty: true })];
    const plan = resolveWorkspaceTabOpen(tabs, "b.md", "preview");
    expect(plan.replaceId).toBeNull();
    const next = tab("next", "b.md", "B", { preview: true });
    const committed = commitOpenedWorkspaceTab(tabs, next, plan.replaceId);
    expect(committed.map((entry) => [entry.id, entry.preview])).toEqual([
      ["preview", false],
      ["next", true]
    ]);
  });

  it("does not replace a pinned tab when opening another preview", () => {
    const tabs = [tab("1", "a.md"), tab("2", "b.md")];
    const plan = resolveWorkspaceTabOpen(tabs, "c.md", "preview");
    expect(plan.replaceId).toBeNull();
    const committed = commitOpenedWorkspaceTab(tabs, tab("3", "c.md", "C", { preview: true }), null);
    expect(committed).toHaveLength(3);
    expect(committed[2]?.preview).toBe(true);
  });

  it("pins a preview tab in place", () => {
    const tabs = [tab("1", "a.md", "A", { preview: true })];
    expect(pinDocumentTab(tabs, "1")[0]?.preview).toBe(false);
  });

  it("appends a pinned open without touching an existing preview", () => {
    const tabs = [tab("preview", "a.md", "A", { preview: true })];
    const plan = resolveWorkspaceTabOpen(tabs, "b.md", "pinned");
    expect(plan.replaceId).toBeNull();
    const committed = commitOpenedWorkspaceTab(tabs, tab("next", "b.md"), null);
    expect(committed.map((entry) => [entry.id, entry.preview])).toEqual([
      ["preview", true],
      ["next", false]
    ]);
  });
});
