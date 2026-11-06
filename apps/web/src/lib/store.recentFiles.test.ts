import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostApi } from "@mdword/shared";

const host = vi.hoisted(() => {
  const files: Record<string, unknown> = {
    openPath: async (path: string) => ({ path, content: host.content })
  };
  return {
    content: "# Recent document\n\nbody\n",
    prefs: { recentFiles: ["/notes/a.md", "/notes/b.md"] as unknown },
    opened: [] as string[],
    openPathCalls: [] as string[],
    failWith: null as Error | null,
    files
  };
});

vi.mock("./host", () => ({
  getHost: () =>
    ({
      platform: "electron",
      app: {
        getPreferences: async () => host.prefs,
        readRecovery: async () => null,
        writeRecovery: async () => undefined,
        clearRecovery: async () => undefined
      },
      files: host.files,
      shell: {},
      export: {}
    }) as unknown as HostApi
}));

const { useApp } = await import("./store");

function canReopen() {
  host.files.openRecent = async (path: string) => {
    if (host.failWith) throw host.failWith;
    host.opened.push(path);
    return { path, content: host.content };
  };
}

beforeEach(() => {
  delete host.files.openRecent;
  host.opened.length = 0;
  host.openPathCalls.length = 0;
  host.failWith = null;
  host.prefs = { recentFiles: ["/notes/a.md", "/notes/b.md"] };
  host.content = "# Recent document\n\nbody\n";
  useApp.setState({
    recentFiles: [],
    busy: null,
    errorMessage: null,
    workspace: null,
    tabs: [],
    activeTabId: "",
    path: null,
    model: undefined as never,
    dirty: false
  });
});

describe("recent files", () => {
  it("stays empty when the host cannot reopen a path", async () => {
    await useApp.getState().loadRecentFiles();
    expect(useApp.getState().recentFiles).toEqual([]);
  });

  it("loads the sanitized list from preferences", async () => {
    canReopen();
    host.prefs = { recentFiles: ["/notes/a.md", 7, null, "/notes/a.md", " ", "/notes/b.md"] };

    await useApp.getState().loadRecentFiles();

    expect(useApp.getState().recentFiles).toEqual(["/notes/a.md", "/notes/b.md"]);
  });

  it("opens the preloaded content without reading the file again", async () => {
    canReopen();
    const openPath = vi.fn(async (path: string) => {
      host.openPathCalls.push(path);
      return { path, content: host.content };
    });
    host.files.openPath = openPath;

    await useApp.getState().openRecentFile("/notes/a.md");

    expect(openPath).not.toHaveBeenCalled();
    expect(host.opened).toEqual(["/notes/a.md"]);
    const state = useApp.getState();
    expect(state.path).toBe("/notes/a.md");
    expect(state.model.source).toBe(host.content);
    expect(state.tabs).toHaveLength(1);
    expect(state.busy).toBeNull();
  });

  it("reports a file that disappeared from the recent list", async () => {
    canReopen();
    host.failWith = new Error("This file is not in the recent list");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await useApp.getState().openRecentFile("/notes/gone.md");

      const state = useApp.getState();
      expect(state.errorMessage).toMatch(/Could not open/);
      expect(state.busy).toBeNull();
      expect(state.tabs).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
