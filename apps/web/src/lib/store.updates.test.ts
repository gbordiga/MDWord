import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "@mdword/shared";
import { openDocument } from "@mdword/document-model";

type Listener = (status: UpdateStatus) => void;

const host = vi.hoisted(() => ({
  enabled: true,
  status: { state: "idle" } as unknown,
  checkResult: { state: "none" } as unknown,
  checkError: null as Error | null,
  listeners: [] as Listener[],
  installed: 0,
  saves: [] as { path: string; content: string }[],
  saveAsName: null as string | null
}));

vi.mock("./host", () => ({
  getHost: () => ({
    platform: "electron",
    app: {
      ...(host.enabled
        ? {
            updates: {
              status: async () => host.status,
              check: async () => {
                if (host.checkError) throw host.checkError;
                return host.checkResult;
              },
              install: async () => {
                host.installed += 1;
              },
              onStatus: (listener: Listener) => {
                host.listeners.push(listener);
                return () => {
                  host.listeners = host.listeners.filter((entry) => entry !== listener);
                };
              }
            }
          }
        : {}),
      readRecovery: async () => null,
      writeRecovery: async () => undefined,
      clearRecovery: async () => undefined
    },
    files: {
      save: async (args: { path: string; content: string }) => {
        host.saves.push(args);
      },
      saveAs: async () => host.saveAsName,
      read: async () => {
        throw new Error("File handle missing");
      }
    },
    shell: {},
    export: {}
  })
}));

const { useApp } = await import("./store");
const { createUntitledTab } = await import("./documentTabs");

beforeEach(() => {
  host.enabled = true;
  host.status = { state: "idle" };
  host.checkResult = { state: "none" };
  host.checkError = null;
  host.listeners = [];
  host.installed = 0;
  host.saves.length = 0;
  host.saveAsName = null;
  useApp.setState({
    updateStatus: null,
    updatesSupported: false,
    tabs: [],
    activeTabId: "",
    busy: null,
    errorMessage: null,
    dirty: false
  });
});

describe("desktop updates", () => {
  it("reports support and follows status events until unsubscribed", async () => {
    const stop = useApp.getState().connectUpdates();
    await vi.waitFor(() => expect(useApp.getState().updatesSupported).toBe(true));
    expect(useApp.getState().updateStatus).toEqual({ state: "idle" });

    for (const listener of [...host.listeners]) listener({ state: "downloaded", version: "0.2.0" });
    expect(useApp.getState().updateStatus).toEqual({ state: "downloaded", version: "0.2.0" });

    stop();
    for (const listener of [...host.listeners]) listener({ state: "error", message: "late" });
    expect(useApp.getState().updateStatus).toEqual({ state: "downloaded", version: "0.2.0" });
  });

  it("hides the controls when the build cannot update itself", async () => {
    host.status = { state: "unsupported" };
    const stop = useApp.getState().connectUpdates();
    await vi.waitFor(() => expect(useApp.getState().updateStatus).toEqual({ state: "unsupported" }));
    expect(useApp.getState().updatesSupported).toBe(false);
    stop();
  });

  it("stays disabled when the host has no update bridge", async () => {
    host.enabled = false;
    const stop = useApp.getState().connectUpdates();
    expect(useApp.getState().updatesSupported).toBe(false);
    expect(useApp.getState().updateStatus).toBeNull();

    await useApp.getState().checkForUpdates();
    await useApp.getState().installUpdate();
    expect(host.installed).toBe(0);
    stop();
  });

  it("surfaces a failed manual check", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      host.checkError = new Error("offline");
      await useApp.getState().checkForUpdates();
      expect(useApp.getState().updateStatus).toEqual({
        state: "error",
        message: "Could not check for updates."
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("installs without prompting when nothing is dirty", async () => {
    useApp.setState({ updateStatus: { state: "downloaded", version: "0.2.0" } });
    await useApp.getState().installUpdate();
    expect(host.installed).toBe(1);
  });

  it("saves dirty tabs before restarting into the update", async () => {
    const source = "---\ntitle: Doc\n---\n\nbody\n";
    const tab = {
      ...createUntitledTab(openDocument(source), source),
      path: "/ws/doc.md",
      dirty: true
    };
    useApp.setState({
      tabs: [tab],
      activeTabId: tab.id,
      model: tab.model,
      path: tab.path,
      dirty: true,
      lastSavedContent: "",
      updateStatus: { state: "downloaded", version: "0.2.0" }
    });

    await useApp.getState().installUpdate();

    expect(host.saves.map((save) => save.path)).toEqual(["/ws/doc.md"]);
    expect(host.installed).toBe(1);
  });

  it("does not restart when an unsaved document cannot be saved", async () => {
    const source = "---\ntitle: Draft\n---\n\ntext\n";
    const tab = { ...createUntitledTab(openDocument(source), source), dirty: true };
    useApp.setState({
      tabs: [tab],
      activeTabId: tab.id,
      model: tab.model,
      path: null,
      dirty: true,
      lastSavedContent: tab.lastSavedContent,
      updateStatus: { state: "downloaded", version: "0.2.0" }
    });
    host.saveAsName = null;

    await useApp.getState().installUpdate();

    expect(host.installed).toBe(0);
    expect(useApp.getState().updateStatus).toEqual({ state: "downloaded", version: "0.2.0" });
  });
});
