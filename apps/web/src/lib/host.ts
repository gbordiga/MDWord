import {
  defaultPreferences,
  MAX_WORKSPACE_LIST_DEPTH,
  MAX_WORKSPACE_LIST_ENTRIES,
  shouldSkipWorkspaceDir,
  shouldSkipWorkspaceFile,
  type HostApi,
  type OpenDocumentResult,
  type UserPreferences
} from "@mdword/shared";
import { isNativeApp, openNativeUrl, shareNativeFile, writeNativeDocument } from "./native";

const DB = "mdword";
const PREFS = "preferences";
const RECOVERY = "recovery";

export function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean((window as Window & { mdword?: HostApi }).mdword);
}

export function getHost(): HostApi {
  if (typeof window !== "undefined" && (window as Window & { mdword?: HostApi }).mdword) {
    return (window as Window & { mdword: HostApi }).mdword;
  }
  if (isNativeApp()) return capacitorHost;
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
  queryPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

type DirHandle = {
  name: string;
  kind?: "directory";
  entries(): AsyncIterable<[string, FsHandle | DirHandle]>;
  queryPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

type WindowFs = Window & {
  showOpenFilePicker?: (opts?: unknown) => Promise<FsHandle[]>;
  showSaveFilePicker?: (opts?: unknown) => Promise<FsHandle>;
  showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle>;
};

const fileHandles = new Map<string, FsHandle>();
const fileTexts = new Map<string, string>();

function isDirectoryHandle(handle: FsHandle | DirHandle): handle is DirHandle {
  return handle.kind === "directory";
}

async function collectFolderEntries(
  dir: DirHandle,
  prefix: string,
  depth: number,
  out: { path: string; name: string; isDirectory: boolean }[]
): Promise<void> {
  if (depth > MAX_WORKSPACE_LIST_DEPTH || out.length >= MAX_WORKSPACE_LIST_ENTRIES) return;
  await ensureHandleAccess(dir, "read");
  for await (const [name, handle] of dir.entries()) {
    if (out.length >= MAX_WORKSPACE_LIST_ENTRIES) return;
    if (shouldSkipWorkspaceFile(name)) continue;
    const isDirectory = isDirectoryHandle(handle);
    if (isDirectory && shouldSkipWorkspaceDir(name)) continue;
    const filePath = `${prefix}/${name}`;
    out.push({ path: filePath, name, isDirectory });
    if (isDirectory) {
      await collectFolderEntries(handle, filePath, depth + 1, out);
      continue;
    }
    const fileHandle = handle as FsHandle;
    fileHandles.set(filePath, fileHandle);
    if (!fileHandles.has(name)) fileHandles.set(name, fileHandle);
  }
}

async function ensureHandleAccess(handle: FsHandle | DirHandle, mode: "read" | "readwrite"): Promise<boolean> {
  try {
    if (typeof handle.queryPermission === "function") {
      const current = await handle.queryPermission({ mode });
      if (current === "granted") return true;
    }
    if (typeof handle.requestPermission === "function") {
      return (await handle.requestPermission({ mode })) === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

async function textFromHandle(handle: FsHandle, key: string): Promise<string> {
  const cached = fileTexts.get(key);
  if (cached !== undefined) return cached;
  await ensureHandleAccess(handle, "read");
  const file = await handle.getFile();
  const text = await file.text();
  fileTexts.set(key, text);
  return text;
}

function pickFileWithInput(accept = ".md,.markdown,text/markdown"): Promise<OpenDocumentResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ path: file.name, content: await file.text() });
    };
    input.click();
  });
}

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
        try {
          const handles = await picker({
            types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown"] } }]
          });
          const handle = handles[0];
          if (!handle) return null;
          await ensureHandleAccess(handle, "readwrite");
          const content = await textFromHandle(handle, handle.name);
          fileHandles.set(handle.name, handle);
          return { path: handle.name, content };
        } catch {
          return pickFileWithInput();
        }
      }
      return pickFileWithInput();
    },
    async openPath(path: string) {
      const cached = fileTexts.get(path) ?? fileTexts.get(path.split("/").pop() ?? path);
      if (cached !== undefined) return { path, content: cached };
      const handle = fileHandles.get(path) ?? fileHandles.get(path.split("/").pop() ?? path);
      if (!handle) throw new Error("File is not available in this browser session");
      const content = await textFromHandle(handle, path);
      return { path, content };
    },
    async save({ path, content }) {
      const handle = fileHandles.get(path);
      if (handle) {
        await ensureHandleAccess(handle, "readwrite");
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        fileTexts.set(path, content);
        fileTexts.set(handle.name, content);
        return;
      }
      if (isNativeApp()) {
        await writeNativeDocument(path || "document.md", content);
        nativeWritten.add(path || "document.md");
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
      if (isNativeApp()) {
        const name = suggestedName || "document.md";
        const uri = await writeNativeDocument(name, content);
        nativeWritten.add(name);
        await shareNativeFile("Save MDWord document", uri);
        return name;
      }
      download(suggestedName, content);
      return suggestedName;
    },
    async openFolder() {
      const picker = (window as WindowFs).showDirectoryPicker;
      if (!picker) return null;
      const dir = (await picker()) as unknown as DirHandle;
      await ensureHandleAccess(dir, "read");
      folderHandle = dir;
      return dir.name;
    },
    async list(folder) {
      if (!folderHandle) return [];
      const out: { path: string; name: string; isDirectory: boolean }[] = [];
      await collectFolderEntries(folderHandle, folder, 0, out);
      return out;
    },
    async read(path) {
      const cached = fileTexts.get(path) ?? fileTexts.get(path.split("/").pop() ?? path);
      if (cached !== undefined) return cached;
      const handle = fileHandles.get(path) ?? fileHandles.get(path.split("/").pop() ?? path);
      if (!handle) throw new Error("File handle missing");
      return textFromHandle(handle, path);
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
      return fileHandles.has(path) || nativeWritten.has(path);
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
        logs: ["telemetry=off", `electron=${isElectron()}`, `native=${isNativeApp()}`]
      };
    },
    async takeLaunchFile() {
      return null;
    },
    onOpenDocument() {
      return () => undefined;
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
      if (isNativeApp()) {
        await openNativeUrl(url);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
};

let folderHandle: DirHandle | null = null;
const nativeWritten = new Set<string>();

const capacitorHost: HostApi = {
  ...webHost,
  platform: "capacitor",
  app: {
    ...webHost.app,
    async exportDiagnostics() {
      const bundle = await webHost.app.exportDiagnostics();
      return { ...bundle, platform: "capacitor" };
    }
  }
};

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
