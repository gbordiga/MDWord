import {
  defaultPreferences,
  type HostApi,
  type OpenDocumentResult,
  type UserPreferences
} from "@mdword/shared";

const DB = "mdword";
const PREFS = "preferences";
const RECOVERY = "recovery";

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean((window as Window & { mdword?: HostApi }).mdword);
}

export function getHost(): HostApi {
  if (typeof window !== "undefined" && (window as Window & { mdword?: HostApi }).mdword) {
    return (window as Window & { mdword: HostApi }).mdword;
  }
  return webHost;
}

async function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PREFS);
      req.result.createObjectStore(RECOVERY);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type FsHandle = {
  name: string;
  kind: "file" | "directory";
  getFile(): Promise<File>;
  createWritable(): Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

type DirHandle = {
  name: string;
  entries(): AsyncIterable<[string, FsHandle]>;
};

type WindowFs = Window & {
  showOpenFilePicker?: (opts?: unknown) => Promise<FsHandle[]>;
  showSaveFilePicker?: (opts?: unknown) => Promise<FsHandle>;
  showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle>;
};

const fileHandles = new Map<string, FsHandle>();

function download(name: string, content: string, type = "text/markdown"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const webHost: HostApi = {
  platform: "web",
  files: {
    async open(): Promise<OpenDocumentResult | null> {
      const picker = (window as WindowFs).showOpenFilePicker;
      if (picker) {
        const handles = await picker({
          types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown"] } }]
        });
        const handle = handles[0];
        if (!handle) return null;
        const file = await handle.getFile();
        const content = await file.text();
        fileHandles.set(handle.name, handle);
        return { path: handle.name, content };
      }
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".md,.markdown,text/markdown";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          resolve({ path: file.name, content: await file.text() });
        };
        input.click();
      });
    },
    async openPath(path: string) {
      const handle = fileHandles.get(path);
      if (!handle) throw new Error("File is not available in this browser session");
      const file = await handle.getFile();
      return { path, content: await file.text() };
    },
    async save({ path, content }) {
      const handle = fileHandles.get(path);
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      }
      download(path || "document.md", content);
    },
    async saveAs(content, suggestedName = "document.md") {
      const picker = (window as WindowFs).showSaveFilePicker;
      if (picker) {
        const handle = await picker({
          suggestedName,
          types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        fileHandles.set(handle.name, handle);
        return handle.name;
      }
      download(suggestedName, content);
      return suggestedName;
    },
    async openFolder() {
      const picker = (window as WindowFs).showDirectoryPicker;
      if (!picker) return null;
      const dir = (await picker()) as unknown as DirHandle;
      folderHandle = dir;
      return dir.name;
    },
    async list(folder) {
      if (!folderHandle) return [];
      const out: { path: string; name: string; isDirectory: boolean }[] = [];
      const entries = folderHandle.entries();
      for await (const [name, handle] of entries) {
        out.push({
          path: `${folder}/${name}`,
          name,
          isDirectory: handle.kind === "directory"
        });
        if (handle.kind === "file" && name.endsWith(".md")) {
          fileHandles.set(name, handle);
          fileHandles.set(`${folder}/${name}`, handle);
        }
      }
      return out;
    },
    async read(path) {
      const handle = fileHandles.get(path) ?? fileHandles.get(path.split("/").pop() ?? path);
      if (!handle) throw new Error("File handle missing");
      return (await handle.getFile()).text();
    },
    async write(path, content) {
      await this.save({ path, content });
    },
    async exists(path) {
      return fileHandles.has(path);
    },
    async rename() {
      throw new Error("Rename is available in the desktop app");
    },
    async copyIntoAssets() {
      throw new Error("Copy into assets is available in the desktop app");
    },
    async canWrite(path: string) {
      return fileHandles.has(path);
    }
  },
  app: {
    async getPreferences() {
      return (await idbGet<UserPreferences>(PREFS, "user")) ?? defaultPreferences;
    },
    async setPreferences(prefs) {
      await idbSet(PREFS, "user", prefs);
    },
    async listRecovery() {
      return [];
    },
    async writeRecovery(id, content) {
      await idbSet(RECOVERY, id, { content, updatedMs: Date.now() });
    },
    async readRecovery(id) {
      const row = await idbGet<{ content: string }>(RECOVERY, id);
      return row?.content ?? null;
    },
    async clearRecovery(id) {
      const db = await idb();
      db.transaction(RECOVERY, "readwrite").objectStore(RECOVERY).delete(id);
    },
    async exportDiagnostics() {
      return {
        appVersion: "0.1.0",
        platform: "web",
        logs: ["telemetry=off", `electron=${isElectron()}`]
      };
    }
  },
  export: {
    async pdf(html) {
      (window as Window & { __MDWORD_LAST_EXPORT_HTML__?: string }).__MDWORD_LAST_EXPORT_HTML__ = html;
      if (navigator.webdriver) return new Uint8Array();
      const iframe = document.createElement("iframe");
      iframe.title = "Print";
      iframe.setAttribute("srcdoc", html);
      iframe.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#fff";
      document.body.appendChild(iframe);
      await new Promise<void>((resolve) => {
        iframe.addEventListener("load", () => resolve(), { once: true });
        window.setTimeout(resolve, 500);
      });
      const win = iframe.contentWindow;
      if (win) await waitForPagedPrint(win);
      const cleanup = () => iframe.remove();
      win?.addEventListener("afterprint", cleanup);
      window.setTimeout(cleanup, 120_000);
      win?.focus();
      win?.print();
      return new Uint8Array();
    },
    async print(html) {
      await this.pdf(html, {});
    }
  },
  shell: {
    async openExternal(url) {
      if (!/^https?:/i.test(url) && !url.startsWith("mailto:")) return;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
};

let folderHandle: DirHandle | null = null;

function waitForPagedPrint(win: Window): Promise<void> {
  const doc = win.document;
  if (!doc.querySelector('script[src*="paged"]')) return Promise.resolve();
  if (doc.documentElement.dataset.pagedReady === "1") return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (doc.documentElement.dataset.pagedReady === "1" || Date.now() - started > 6000) {
        resolve();
        return;
      }
      win.setTimeout(tick, 40);
    };
    tick();
  });
}
