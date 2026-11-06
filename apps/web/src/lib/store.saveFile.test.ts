import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDocument } from "@mdword/document-model";

type Deferred = { resolve: () => void; reject: (error: unknown) => void };

const host = vi.hoisted(() => ({
  saves: [] as { path: string; content: string }[],
  saveAsName: null as string | null,
  deferred: null as Deferred | null,
  disk: new Map<string, string>()
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
      saveAs: async () => host.saveAsName,
      read: async (path: string) => {
        const content = host.disk.get(path);
        if (content === undefined) throw new Error("File handle missing");
        return content;
      }
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
  host.disk.clear();
  useApp.setState({ externalDialog: null });
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

const BASE_SOURCE = "---\ntitle: Doc\n---\n\nfirst draft\n";
const LOCAL_SOURCE = "---\ntitle: Doc\n---\n\nsecond draft\n";
const EXTERNAL_SOURCE = "---\ntitle: Doc\n---\n\nedited elsewhere\n";

function openSavedTab() {
  const model = openDocument(BASE_SOURCE);
  useApp.setState({
    path: "/ws/doc.md",
    model,
    dirty: false,
    lastSavedContent: model.source,
    lastSavedAt: Date.now(),
    busy: null,
    errorMessage: null,
    externalDialog: null
  });
}

function editTo(source: string) {
  useApp.setState({ model: openDocument(source), dirty: true });
}

describe("external changes on disk", () => {
  it("does not overwrite a file that changed outside the app", async () => {
    openSavedTab();
    editTo(LOCAL_SOURCE);
    host.disk.set("/ws/doc.md", EXTERNAL_SOURCE);

    await useApp.getState().saveFile();

    expect(host.saves).toEqual([]);
    expect(useApp.getState().externalDialog).toEqual({
      tabId: useApp.getState().activeTabId,
      path: "/ws/doc.md",
      incoming: EXTERNAL_SOURCE
    });
    expect(useApp.getState().dirty).toBe(true);
  });

  it("writes the local text when the user chooses Overwrite", async () => {
    openSavedTab();
    editTo(LOCAL_SOURCE);
    host.disk.set("/ws/doc.md", EXTERNAL_SOURCE);
    await useApp.getState().saveFile();

    const answer = useApp.getState().resolveExternalConflict("overwrite");
    await vi.waitFor(() => expect(host.saves).toHaveLength(1));
    host.deferred?.resolve();
    await answer;

    expect(host.saves[0]?.content).toBe(LOCAL_SOURCE);
    expect(useApp.getState().dirty).toBe(false);
    expect(useApp.getState().externalDialog).toBeNull();
  });

  it("adopts the disk version when the user chooses Reload", async () => {
    openSavedTab();
    editTo(LOCAL_SOURCE);
    host.disk.set("/ws/doc.md", EXTERNAL_SOURCE);
    await useApp.getState().saveFile();

    await useApp.getState().resolveExternalConflict("reload");

    const state = useApp.getState();
    expect(state.externalDialog).toBeNull();
    expect(state.model.source).toBe(EXTERNAL_SOURCE);
    expect(state.lastSavedContent).toBe(EXTERNAL_SOURCE);
    expect(state.dirty).toBe(false);
    expect(state.tabs[0]?.model.source).toBe(EXTERNAL_SOURCE);
    expect(host.saves).toEqual([]);
  });

  it("keeps the pending edit when the user cancels", async () => {
    openSavedTab();
    editTo(LOCAL_SOURCE);
    host.disk.set("/ws/doc.md", EXTERNAL_SOURCE);
    await useApp.getState().saveFile();

    await useApp.getState().resolveExternalConflict("cancel");

    expect(useApp.getState().externalDialog).toBeNull();
    expect(useApp.getState().model.source).toBe(LOCAL_SOURCE);
    expect(useApp.getState().dirty).toBe(true);
    expect(host.saves).toEqual([]);
  });

  it("saves normally when the disk still matches the opened file", async () => {
    openSavedTab();
    editTo(LOCAL_SOURCE);
    host.disk.set("/ws/doc.md", BASE_SOURCE);

    const pending = useApp.getState().saveFile();
    await vi.waitFor(() => expect(host.saves).toHaveLength(1));
    host.deferred?.resolve();
    await pending;

    expect(host.saves[0]?.content).toBe(LOCAL_SOURCE);
    expect(useApp.getState().externalDialog).toBeNull();
    expect(useApp.getState().dirty).toBe(false);
  });

  it("still saves when the disk cannot be read", async () => {
    openSavedTab();
    editTo(LOCAL_SOURCE);

    const pending = useApp.getState().saveFile();
    await vi.waitFor(() => expect(host.saves).toHaveLength(1));
    host.deferred?.resolve();
    await pending;

    expect(useApp.getState().externalDialog).toBeNull();
    expect(useApp.getState().dirty).toBe(false);
  });
});
