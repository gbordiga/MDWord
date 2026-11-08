import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDocument } from "@mdword/document-model";

type Entry = { path: string; name: string; isDirectory: boolean };

const host = vi.hoisted(() => ({
  entries: [] as Entry[],
  writes: [] as { path: string; content: string }[],
  mkdirs: [] as string[],
  renames: [] as { from: string; to: string }[],
  copies: [] as { from: string; to: string }[],
  removes: [] as string[]
}));

vi.mock("./host", () => ({
  getHost: () => ({
    app: {
      readRecovery: async () => null,
      writeRecovery: async () => undefined,
      clearRecovery: async () => undefined
    },
    files: {
      list: async () => host.entries,
      read: async () => "",
      readMany: async () => [],
      write: async (path: string, content: string) => {
        host.writes.push({ path, content });
        host.entries.push({ path, name: path.split("/").pop() ?? path, isDirectory: false });
      },
      mkdir: async (path: string) => {
        host.mkdirs.push(path);
        host.entries.push({ path, name: path.split("/").pop() ?? path, isDirectory: true });
      },
      rename: async (from: string, to: string) => {
        host.renames.push({ from, to });
        host.entries = host.entries.map((entry) =>
          entry.path === from ? { ...entry, path: to, name: to.split("/").pop() ?? to } : entry
        );
      },
      copy: async (from: string, to: string) => {
        host.copies.push({ from, to });
      },
      remove: async (path: string) => {
        host.removes.push(path);
        host.entries = host.entries.filter((entry) => entry.path !== path);
      },
      exists: async (path: string) => host.entries.some((entry) => entry.path === path)
    },
    shell: {},
    export: {}
  })
}));

const { useApp } = await import("./store");
const { createUntitledTab } = await import("./documentTabs");

function startSession(files: Entry[], tabPath: string | null = null) {
  host.entries = [...files];
  const source = "---\ntitle: Doc\n---\n\nbody\n";
  const tab = { ...createUntitledTab(openDocument(source), source), path: tabPath };
  useApp.setState({
    workspace: { root: "/ws", files: host.entries, index: { documents: [] }, workspaceMdoc: undefined },
    tabs: [tab],
    activeTabId: tab.id,
    model: tab.model,
    path: tab.path,
    dirty: false,
    lastSavedContent: tab.lastSavedContent,
    busy: null,
    errorMessage: null
  });
  return tab;
}

const notes: Entry = { path: "/ws/notes.md", name: "notes.md", isDirectory: false };
const other: Entry = { path: "/ws/other.md", name: "other.md", isDirectory: false };

beforeEach(() => {
  host.entries = [];
  host.writes.length = 0;
  host.mkdirs.length = 0;
  host.renames.length = 0;
  host.copies.length = 0;
  host.removes.length = 0;
  useApp.setState({ workspace: null, tabs: [], busy: null, errorMessage: null });
});

describe("workspace actions", () => {
  it("refuses every action until a folder is open", async () => {
    const actions = useApp.getState();
    await expect(actions.createWorkspaceFile("/ws", "a.md")).rejects.toThrow("Open a project first");
    await expect(actions.createWorkspaceFolder("/ws", "a")).rejects.toThrow("Open a project first");
    await expect(actions.renameWorkspaceEntry("/ws/a.md", "b.md")).rejects.toThrow("Open a project first");
    await expect(actions.copyWorkspaceEntry("/ws/a.md", "/ws")).rejects.toThrow("Open a project first");
    await expect(actions.deleteWorkspaceEntry("/ws/a.md")).rejects.toThrow("Open a project first");
  });

  it("validates names before touching the disk", async () => {
    startSession([notes]);
    await expect(useApp.getState().createWorkspaceFile("/ws", "bad/name.md")).rejects.toThrow(
      "Enter a valid file name"
    );
    await expect(useApp.getState().createWorkspaceFolder("/ws", "..")).rejects.toThrow(
      "Enter a valid folder name"
    );
    expect(host.writes).toEqual([]);
    expect(host.mkdirs).toEqual([]);
  });

  it("creates a markdown file with a unique name and returns the new path", async () => {
    startSession([notes]);
    const dest = await useApp.getState().createWorkspaceFile("/ws", "notes.md");

    expect(dest).toBe("/ws/notes (2).md");
    expect(host.writes.map((write) => write.path)).toEqual(["/ws/notes (2).md"]);
    expect(host.writes[0]?.content.startsWith("---")).toBe(true);
  });

  it("creates a folder and returns its path", async () => {
    startSession([notes]);
    const dest = await useApp.getState().createWorkspaceFolder("/ws", "assets");
    expect(dest).toBe("/ws/assets");
    expect(host.mkdirs).toEqual(["/ws/assets"]);
  });

  it("rename is a no-op when the name did not change", async () => {
    const tab = startSession([notes], "/ws/notes.md");
    const dest = await useApp.getState().renameWorkspaceEntry("/ws/notes.md", "notes.md");
    expect(dest).toBe("/ws/notes.md");
    expect(host.renames).toEqual([]);
    expect(useApp.getState().tabs[0]?.path).toBe(tab.path);
  });

  it("rename refuses a name that is already taken", async () => {
    startSession([notes, other]);
    await expect(useApp.getState().renameWorkspaceEntry("/ws/notes.md", "other.md")).rejects.toThrow(
      "A file or folder with that name already exists"
    );
    expect(host.renames).toEqual([]);
  });

  it("rename moves the open tab to the new path", async () => {
    startSession([notes], "/ws/notes.md");
    const dest = await useApp.getState().renameWorkspaceEntry("/ws/notes.md", "renamed.md");

    expect(dest).toBe("/ws/renamed.md");
    expect(host.renames).toEqual([{ from: "/ws/notes.md", to: "/ws/renamed.md" }]);
    const state = useApp.getState();
    expect(state.path).toBe("/ws/renamed.md");
    expect(state.tabs[0]?.path).toBe("/ws/renamed.md");
  });

  it("delete refuses the open folder", async () => {
    startSession([notes]);
    await expect(useApp.getState().deleteWorkspaceEntry("/ws")).rejects.toThrow(
      "Cannot delete the open project"
    );
    expect(host.removes).toEqual([]);
  });

  it("delete closes the tabs inside the deleted path", async () => {
    startSession([notes, other], "/ws/notes.md");
    await useApp.getState().deleteWorkspaceEntry("/ws/notes.md");

    expect(host.removes).toEqual(["/ws/notes.md"]);
    const state = useApp.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.path).toBeNull();
  });
});

describe("copyWorkspaceEntry", () => {
  it("copies into the target folder with a unique name", async () => {
    startSession([notes, { path: "/ws/notes (2).md", name: "notes (2).md", isDirectory: false }]);
    const dest = await useApp.getState().copyWorkspaceEntry("/ws/notes.md", "/ws");
    expect(dest).toBe("/ws/notes (3).md");
    expect(host.copies).toEqual([{ from: "/ws/notes.md", to: "/ws/notes (3).md" }]);
  });
});
