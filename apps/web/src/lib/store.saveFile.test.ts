import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDocument } from "@mdword/document-model";

type Deferred = { resolve: () => void; reject: (error: unknown) => void };

const host = vi.hoisted(() => ({
  saves: [] as { path: string; content: string }[],
  saveAsName: null as string | null,
  deferred: null as Deferred | null
}));

vi.mock("./host", () => ({
  getHost: () => ({
    app: {
      readRecovery: async () => null,
      writeRecovery: async () => undefined,
      clearRecovery: async () => undefined
    },
    files: {
      save: (args: { path: string; content: string }) => {
        host.saves.push(args);
        return new Promise<void>((resolve, reject) => {
          host.deferred = { resolve, reject };
        });
      },
      saveAs: async () => host.saveAsName
    },
    shell: {},
    export: {}
  })
}));

const { useApp } = await import("./store");
const { createUntitledTab } = await import("./documentTabs");

function activeTab() {
  const state = useApp.getState();
  const tab = state.tabs.find((entry) => entry.id === state.activeTabId);
  if (!tab) throw new Error("no active tab");
  return tab;
}

async function startSave() {
  const pending = useApp.getState().saveFile();
  await vi.waitFor(() => expect(host.saves).toHaveLength(1));
  const deferred = host.deferred;
  if (!deferred) throw new Error("save never reached the host");
  return { pending, deferred };
}

beforeEach(() => {
  host.saves.length = 0;
  host.deferred = null;
  host.saveAsName = null;
});

describe("saveFile", () => {
  let source: string;

  beforeEach(() => {
    const model = openDocument("---\ntitle: Doc\n---\n\nfirst draft\n");
    source = model.source;
    useApp.setState({
      path: "/ws/doc.md",
      model,
      dirty: true,
      lastSavedContent: "",
      lastSavedAt: null,
      busy: null,
      errorMessage: null
    });
  });

  it("marks the document clean when nothing changed during the write", async () => {
    const { pending, deferred } = await startSave();
    expect(host.saves[0]?.content).toBe(source);
    deferred.resolve();
    await pending;

    const state = useApp.getState();
    expect(state.dirty).toBe(false);
    expect(state.lastSavedContent).toBe(source);
    expect(state.model.source).toBe(source);
    expect(state.lastSavedAt).not.toBeNull();
    expect(state.busy).toBeNull();
    expect(activeTab().dirty).toBe(false);
  });

  it("keeps edits typed while the write was in flight", async () => {
    const { pending, deferred } = await startSave();

    // The user keeps typing while the disk write is pending.
    const edited = openDocument(source.replace("first draft", "second draft"));
    useApp.setState({ model: edited, dirty: true });

    deferred.resolve();
    await pending;

    const state = useApp.getState();
    expect(state.model.source).toBe(edited.source);
    expect(state.dirty).toBe(true);
    expect(state.lastSavedContent).toBe(source);
    expect(activeTab().dirty).toBe(true);
  });

  it("reports a failed write and keeps the document dirty", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { pending, deferred } = await startSave();
      deferred.reject(new Error("disk full"));
      await pending;

      const state = useApp.getState();
      expect(state.dirty).toBe(true);
      expect(state.errorMessage).toMatch(/still unsaved/);
      expect(state.busy).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("clears the previous failure after a successful retry", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const first = await startSave();
      first.deferred.reject(new Error("disk full"));
      await first.pending;
      expect(useApp.getState().errorMessage).not.toBeNull();

      host.saves.length = 0;
      const retry = await startSave();
      retry.deferred.resolve();
      await retry.pending;

      expect(useApp.getState().errorMessage).toBeNull();
      expect(useApp.getState().dirty).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("saveTab", () => {
  function twoTabs(backgroundPath: string | null) {
    const activeSource = "---\ntitle: Active\n---\n\nactive\n";
    const otherSource = "---\ntitle: Other\n---\n\nother\n";
    const active = {
      ...createUntitledTab(openDocument(activeSource), activeSource),
      path: "/ws/active.md",
      dirty: true
    };
    const background = {
      ...createUntitledTab(openDocument(otherSource), otherSource),
      path: backgroundPath,
      dirty: true
    };
    useApp.setState({
      tabs: [active, background],
      activeTabId: active.id,
      model: active.model,
      path: active.path,
      dirty: active.dirty,
      lastSavedContent: active.lastSavedContent,
      busy: null
    });
    return { active, background };
  }

  it("saves a background tab without switching the visible document", async () => {
    const { active, background } = twoTabs("/ws/other.md");
    const pending = useApp.getState().saveTab(background.id);
    await vi.waitFor(() => expect(host.saves).toHaveLength(1));
    host.deferred?.resolve();
    expect(await pending).toBe(true);

    const state = useApp.getState();
    expect(state.activeTabId).toBe(active.id);
    expect(state.dirty).toBe(true);
    const saved = state.tabs.find((tab) => tab.id === background.id);
    expect(saved?.dirty).toBe(false);
    expect(saved?.path).toBe("/ws/other.md");
  });

  it("saves every dirty tab for the close guard and keeps the visible document", async () => {
    const { active, background } = twoTabs("/ws/other.md");
    const pending = useApp.getState().saveAllDirty();

    await vi.waitFor(() => expect(host.saves).toHaveLength(1));
    host.deferred?.resolve();
    await vi.waitFor(() => expect(host.saves).toHaveLength(2));
    host.deferred?.resolve();

    expect(await pending).toBe(true);
    const state = useApp.getState();
    expect(state.activeTabId).toBe(active.id);
    expect(state.tabs.every((tab) => !tab.dirty)).toBe(true);
  });

  it("leaves the session untouched when the user cancels the file picker", async () => {
    const { active, background } = twoTabs(null);
    expect(await useApp.getState().saveTab(background.id)).toBe(false);

    const state = useApp.getState();
    expect(state.activeTabId).toBe(active.id);
    expect(state.dirty).toBe(true);
    const cancelled = state.tabs.find((tab) => tab.id === background.id);
    expect(cancelled?.dirty).toBe(true);
    expect(cancelled?.path).toBeNull();
  });
});
