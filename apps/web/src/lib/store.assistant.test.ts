import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDocument } from "@mdword/document-model";

vi.mock("./host", () => ({
  getHost: () => ({
    app: {
      readRecovery: async () => null,
      writeRecovery: async () => undefined,
      clearRecovery: async () => undefined
    },
    files: {},
    shell: {},
    export: {}
  })
}));

const { useApp } = await import("./store");
const { createUntitledTab } = await import("./documentTabs");

const SOURCE = "---\ntitle: Doc\n---\n\nHello world\n";

function session() {
  const a = { ...createUntitledTab(openDocument(SOURCE), SOURCE), path: "/ws/a.md" };
  const b = { ...createUntitledTab(openDocument(SOURCE), SOURCE), path: "/ws/b.md" };
  useApp.setState({
    workspace: { root: "/ws", files: [], index: { documents: [] }, workspaceMdoc: undefined },
    tabs: [a, b],
    activeTabId: a.id,
    model: a.model,
    path: a.path,
    dirty: false,
    lastSavedContent: a.lastSavedContent,
    documentUndo: a.documentUndo,
    busy: null,
    errorMessage: null
  });
  return { a, b };
}

beforeEach(() => {
  useApp.setState({ tabs: [], workspace: null });
});

describe("applyAssistantEdit", () => {
  it("is exactly one undo step, sets dirty, and does not coalesce", () => {
    const { a } = session();
    const next1 = SOURCE.replace("world", "there");
    const next2 = next1.replace("Hello", "Hi");
    expect(useApp.getState().applyAssistantEdit(a.id, next1, "e1")).toBe(true);
    expect(useApp.getState().applyAssistantEdit(a.id, next2, "e2")).toBe(true);
    const s = useApp.getState();
    expect(s.model.source).toBe(next2);
    expect(s.dirty).toBe(true);
    expect(s.documentUndo.past).toHaveLength(2);
    expect(useApp.getState().undoDocument()).toBe(true);
    expect(useApp.getState().model.source).toBe(next1);
    expect(useApp.getState().undoDocument()).toBe(true);
    expect(useApp.getState().model.source).toBe(SOURCE);
    expect(useApp.getState().dirty).toBe(false);
  });

  it("never merges with typing recorded just before", () => {
    const { a } = session();
    useApp.getState().applySource(SOURCE + "typed");
    useApp.getState().flushPendingEdits();
    const typed = useApp.getState().model.source;
    useApp.getState().applyAssistantEdit(a.id, typed.replace("Hello", "Hi"), "e1");
    expect(useApp.getState().documentUndo.past).toHaveLength(2);
    useApp.getState().undoDocument();
    expect(useApp.getState().model.source).toBe(typed);
  });

  it("works for a background tab and activates it", () => {
    const { a, b } = session();
    const next = SOURCE.replace("world", "there");
    expect(useApp.getState().applyAssistantEdit(b.id, next, "e1")).toBe(true);
    const s = useApp.getState();
    expect(s.activeTabId).toBe(b.id);
    expect(s.model.source).toBe(next);
    expect(s.tabs.find((t) => t.id === a.id)!.model.source).toBe(SOURCE);
    expect(s.tabs.find((t) => t.id === b.id)!.dirty).toBe(true);
  });

  it("returns false for an unknown tab", () => {
    session();
    expect(useApp.getState().applyAssistantEdit("nope", "x", "e")).toBe(false);
  });

  it("readOpenBuffer returns the buffer, not the disk", () => {
    const { a } = session();
    expect(useApp.getState().readOpenBuffer("/ws/a.md")).toEqual({ tabId: a.id, source: SOURCE });
    expect(useApp.getState().readOpenBuffer("/ws/zzz.md")).toBeNull();
    useApp.getState().applyAssistantEdit(a.id, SOURCE + "more", "e1");
    expect(useApp.getState().readOpenBuffer("/ws/a.md")?.source).toContain("more");
  });
});
