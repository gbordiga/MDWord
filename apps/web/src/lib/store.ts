"use client";

import { create } from "zustand";
import {
  openDocument,
  saveDocument,
  setFrontmatterValues,
  type DocumentModel
} from "@mdword/document-model";
import { displayDocumentTitle, documentDate, isMarkdownFileName, type ViewMode } from "@mdword/shared";
import type { Mdoc } from "@mdword/layout-engine";
import { parseDocument } from "yaml";
import { getHost } from "./host";
import { untitledDocument } from "./untitled";
import { addHistorySnapshot, historyKeyFromPath, newUntitledHistoryKey } from "./documentHistory";
import { clearCrashDraft, writeCrashDraft } from "./recovery";
import {
  applySavedDocument,
  childNamesInFolder,
  isPathOrDescendant,
  isValidWorkspaceEntryName,
  joinWorkspacePath,
  loadWorkspace,
  normalizeNewFileName,
  resolveWikiTarget,
  rewriteWorkspacePath,
  uniqueChildName,
  upsertWorkspaceFile,
  workspaceEntryName,
  workspaceParentPath,
  type WorkspaceState
} from "@mdword/workspace";
import { rewriteDisplayBlobsInTree, tiptapToAst, type TiptapNode } from "@mdword/editor";
import { renderPrintDocument } from "@mdword/renderer";

export type RibbonTab = "file" | "home" | "insert" | "layout" | "references" | "view" | "image" | "table";
export type PageLayoutMode = "pages" | "continuous";

const PAGE_LAYOUT_KEY = "mdword.pageLayout";

export function readPageLayout(): PageLayoutMode {
  try {
    return window.localStorage.getItem(PAGE_LAYOUT_KEY) === "continuous" ? "continuous" : "pages";
  } catch {
    return "pages";
  }
}
export type LeftPanel = "files" | "outline" | "search" | "backlinks" | "history";
export type MobileSheet = "workspace" | "insert" | "properties" | "more" | null;
export type BusyKind = "open" | "save" | "folder" | "export" | "workspace";

export interface BusyState {
  kind: BusyKind;
  label: string;
  blocking: boolean;
}

const VISUAL_APPLY_MS = 160;
const SOURCE_APPLY_MS = 220;
let pendingTiptap: TiptapNode | null = null;
let applyTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSource: string | null = null;
let sourceTimer: ReturnType<typeof setTimeout> | null = null;

function discardPendingVisual(): void {
  pendingTiptap = null;
  if (applyTimer != null) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }
}

function discardPendingSource(): void {
  pendingSource = null;
  if (sourceTimer != null) {
    clearTimeout(sourceTimer);
    sourceTimer = null;
  }
}

function yieldPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Safari/iOS honor @page boxes natively; Chromium (web, Android, Electron) uses Paged.js. */
function webPagedScriptUrl(platform: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (platform === "electron") return "mdword://app/paged.polyfill.min.js";
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|iPhone|iPad|iPod/i.test(ua)) return undefined;
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/i.test(ua)) return undefined;
  return `${window.location.origin}/paged.polyfill.min.js`;
}

export interface AppState {
  model: DocumentModel;
  path: string | null;
  dirty: boolean;
  view: ViewMode;
  pageLayout: PageLayoutMode;
  zoom: number;
  ribbon: RibbonTab;
  left: LeftPanel;
  leftOpen: boolean;
  rightOpen: boolean;
  mobileSheet: MobileSheet;
  paletteOpen: boolean;
  findOpen: boolean;
  findQuery: string;
  workspace: WorkspaceState | null;
  externalDialog: { path: string; incoming: string } | null;
  syncGeneration: number;
  sourceGeneration: number;
  editGeneration: number;
  lastSavedAt: number | null;
  lastDraftAt: number | null;
  lastSavedContent: string;
  historyKey: string;
  busy: BusyState | null;
  applySource: (source: string) => void;
  applyTiptap: (doc: TiptapNode) => void;
  setView: (view: ViewMode) => void;
  setPageLayout: (pageLayout: PageLayoutMode) => void;
  setRibbon: (tab: RibbonTab) => void;
  setLeft: (panel: LeftPanel) => void;
  newDocument: () => void;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  openFolder: () => Promise<void>;
  openWorkspaceFile: (filePath: string) => Promise<void>;
  openWorkspaceFileByTitle: (title: string) => Promise<boolean>;
  refreshWorkspace: () => Promise<void>;
  createWorkspaceFile: (parentPath: string, name: string) => Promise<string>;
  createWorkspaceFolder: (parentPath: string, name: string) => Promise<string>;
  renameWorkspaceEntry: (fromPath: string, newName: string) => Promise<string>;
  copyWorkspaceEntry: (fromPath: string, toParentPath: string) => Promise<string>;
  deleteWorkspaceEntry: (targetPath: string) => Promise<void>;
  exportPdf: () => Promise<void>;
  exportHtml: () => Promise<void>;
  patchMdoc: (mdoc: Mdoc) => void;
  patchFrontmatter: (patch: Record<string, unknown>) => void;
  replaceFrontmatterModel: (model: DocumentModel) => void;
  setZoom: (zoom: number) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setMobileSheet: (sheet: MobileSheet) => void;
  setPalette: (open: boolean) => void;
  setFind: (open: boolean, query?: string) => void;
  finishBusy: (kinds?: BusyKind[]) => void;
  flushPendingEdits: () => void;
  saveDraft: () => Promise<void>;
  restoreHistory: (content: string) => Promise<void>;
  applyRecoveredDraft: (content: string, path: string | null) => Promise<void>;
}

function modelFrom(source: string, workspaceMdoc?: Mdoc): DocumentModel {
  const model = openDocument(source, { workspaceMdoc });
  rewriteDisplayBlobsInTree(model.ast as { [key: string]: unknown });
  return model;
}

function serializedDocument(model: DocumentModel): string {
  rewriteDisplayBlobsInTree(model.ast as { [key: string]: unknown });
  return saveDocument(model);
}

export const useApp = create<AppState>((set, get) => {
  const rememberSavedFile = (path: string, content: string) => {
    const workspace = get().workspace;
    if (!workspace) return;
    set({ workspace: applySavedDocument(workspace, path, content) });
  };

  const reloadWorkspace = async () => {
    const workspace = get().workspace;
    if (!workspace?.root) return;
    try {
      const next = await loadWorkspace(getHost(), workspace.root);
      set({ workspace: next });
    } catch {
      /* keep the optimistic list if a re-list fails */
    }
  };

  const beginBusy = (busy: BusyState) => set({ busy });

  const commitTiptap = (doc: TiptapNode) => {
    try {
      const ast = tiptapToAst(doc);
      const current = get().model;
      set({
        model: { ...current, ast },
        dirty: true,
        editGeneration: get().editGeneration + 1
      });
    } catch (error) {
      console.error("Could not apply visual edits", error);
    }
  };

  const flushVisualEdits = () => {
    if (applyTimer != null) {
      clearTimeout(applyTimer);
      applyTimer = null;
    }
    const doc = pendingTiptap;
    pendingTiptap = null;
    if (doc) commitTiptap(doc);
  };

  const commitSource = (source: string) => {
    const model = modelFrom(source, get().workspace?.workspaceMdoc);
    set({
      model,
      dirty: true,
      sourceGeneration: get().sourceGeneration + 1,
      editGeneration: get().editGeneration + 1
    });
  };

  const flushSourceEdits = () => {
    if (sourceTimer != null) {
      clearTimeout(sourceTimer);
      sourceTimer = null;
    }
    const source = pendingSource;
    pendingSource = null;
    if (source != null) commitSource(source);
  };

  const markSaved = (path: string, content: string, model: DocumentModel) => {
    const historyKey = historyKeyFromPath(path, get().historyKey);
    set({
      path,
      dirty: false,
      model: { ...model, source: content },
      lastSavedAt: Date.now(),
      lastSavedContent: content,
      historyKey
    });
    rememberSavedFile(path, content);
    void addHistorySnapshot({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      docKey: historyKey,
      savedAt: Date.now(),
      title: displayDocumentTitle(model.frontmatter, path),
      content
    });
    void clearCrashDraft();
  };

  const initialSource = untitledDocument();

  return {
  model: modelFrom(initialSource),
  path: null,
  dirty: false,
  view: "document",
  pageLayout: "pages",
  zoom: 1,
  ribbon: "home",
  left: "files",
  leftOpen: true,
  rightOpen: true,
  mobileSheet: null,
  paletteOpen: false,
  findOpen: false,
  findQuery: "",
  workspace: null,
  externalDialog: null,
  syncGeneration: 0,
  sourceGeneration: 0,
  editGeneration: 0,
  lastSavedAt: null,
  lastDraftAt: null,
  lastSavedContent: initialSource,
  historyKey: newUntitledHistoryKey(),
  busy: null,
  flushPendingEdits: () => {
    flushVisualEdits();
    flushSourceEdits();
  },
  finishBusy: (kinds) => {
    const busy = get().busy;
    if (!busy) return;
    if (!kinds || kinds.includes(busy.kind)) set({ busy: null });
  },
  applySource: (source) => {
    pendingSource = source;
    if (sourceTimer != null) return;
    sourceTimer = setTimeout(() => {
      sourceTimer = null;
      flushSourceEdits();
    }, SOURCE_APPLY_MS);
  },
  applyTiptap: (doc) => {
    pendingTiptap = doc;
    if (applyTimer != null) return;
    applyTimer = setTimeout(() => {
      applyTimer = null;
      flushVisualEdits();
    }, VISUAL_APPLY_MS);
  },
  setView: (view) => {
    flushVisualEdits();
    flushSourceEdits();
    set({ view });
  },
  setPageLayout: (pageLayout) => {
    try {
      window.localStorage.setItem(PAGE_LAYOUT_KEY, pageLayout);
    } catch {
      /* ignore quota / private mode */
    }
    set({ pageLayout });
  },
  setRibbon: (ribbon) => set({ ribbon }),
  setLeft: (left) => {
    const compact = typeof window !== "undefined" && window.innerWidth < 1024;
    set(compact ? { left, mobileSheet: "workspace" } : { left, leftOpen: true });
  },
  newDocument: () => {
    discardPendingVisual();
    discardPendingSource();
    const source = untitledDocument();
    void clearCrashDraft();
    set({
      model: modelFrom(source),
      path: null,
      dirty: false,
      lastSavedAt: null,
      lastDraftAt: null,
      lastSavedContent: source,
      historyKey: newUntitledHistoryKey(),
      syncGeneration: get().syncGeneration + 1
    });
  },
  openFile: async () => {
    const host = getHost();
    let result: Awaited<ReturnType<typeof host.files.open>>;
    try {
      result = await host.files.open();
    } catch (error) {
      console.error("Could not open document", error);
      return;
    }
    if (!result) return;
    discardPendingVisual();
    discardPendingSource();
    beginBusy({ kind: "open", label: "Opening document…", blocking: true });
    await yieldPaint();
    try {
      const model = modelFrom(result.content, get().workspace?.workspaceMdoc);
      void clearCrashDraft();
      set({
        model,
        path: result.path,
        dirty: false,
        lastSavedAt: Date.now(),
        lastSavedContent: result.content,
        historyKey: historyKeyFromPath(result.path, get().historyKey),
        syncGeneration: get().syncGeneration + 1
      });
      if (get().view === "source") set({ busy: null });
    } catch (error) {
      console.error("Could not open document", error);
      set({ busy: null });
    }
  },
  saveFile: async () => {
    flushVisualEdits();
    flushSourceEdits();
    const host = getHost();
    const { model, path } = get();
    const content = serializedDocument(model);
    if (!path) {
      const next = await host.files.saveAs(content, "document.md");
      if (!next) return;
      beginBusy({ kind: "save", label: "Saving…", blocking: false });
      try {
        markSaved(next, content, model);
        await reloadWorkspace();
      } finally {
        set({ busy: null });
      }
      return;
    }
    beginBusy({ kind: "save", label: "Saving…", blocking: false });
    await yieldPaint();
    try {
      await host.files.save({ path, content });
      markSaved(path, content, model);
      await reloadWorkspace();
    } catch (error) {
      console.error("Could not save document", error);
    } finally {
      set({ busy: null });
    }
  },
  saveFileAs: async () => {
    flushVisualEdits();
    flushSourceEdits();
    const host = getHost();
    const content = serializedDocument(get().model);
    const next = await host.files.saveAs(content, get().path ?? "document.md");
    if (!next) return;
    beginBusy({ kind: "save", label: "Saving…", blocking: false });
    try {
      markSaved(next, content, get().model);
      await reloadWorkspace();
    } finally {
      set({ busy: null });
    }
  },
  openFolder: async () => {
    const host = getHost();
    const root = await host.files.openFolder();
    if (!root) return;
    beginBusy({ kind: "folder", label: "Indexing workspace…", blocking: true });
    await yieldPaint();
    try {
      const workspace = await loadWorkspace(host, root);
      set({ workspace, busy: null });
    } catch (error) {
      console.error("Could not open folder", error);
      set({ busy: null });
    }
  },
  openWorkspaceFile: async (filePath) => {
    discardPendingVisual();
    discardPendingSource();
    const host = getHost();
    beginBusy({ kind: "workspace", label: "Opening document…", blocking: true });
    await yieldPaint();
    try {
      const result = await host.files.openPath(filePath);
      void clearCrashDraft();
      set({
        model: modelFrom(result.content, get().workspace?.workspaceMdoc),
        path: result.path,
        dirty: false,
        lastSavedAt: Date.now(),
        lastSavedContent: result.content,
        historyKey: historyKeyFromPath(result.path, get().historyKey),
        syncGeneration: get().syncGeneration + 1,
        mobileSheet: null
      });
      if (get().view === "source") set({ busy: null });
    } catch {
      set({ busy: null });
    }
  },
  openWorkspaceFileByTitle: async (title) => {
    const { workspace, path } = get();
    if (!workspace) return false;
    const resolved = resolveWikiTarget(workspace.index, path ?? "", title);
    if (!resolved) return false;
    await get().openWorkspaceFile(resolved);
    return true;
  },
  refreshWorkspace: () => reloadWorkspace(),
  createWorkspaceFile: async (parentPath, name) => {
    flushVisualEdits();
    flushSourceEdits();
    const workspace = get().workspace;
    if (!workspace?.root) throw new Error("Open a folder first");
    const fileName = normalizeNewFileName(name);
    if (!isValidWorkspaceEntryName(fileName)) throw new Error("Enter a valid file name");
    const unique = uniqueChildName(childNamesInFolder(workspace.files, parentPath, workspace.root), fileName);
    const dest = joinWorkspacePath(parentPath, unique);
    const host = getHost();
    const content = isMarkdownFileName(unique) ? untitledDocument() : "";
    await host.files.write(dest, content);
    set({
      workspace: {
        ...workspace,
        files: upsertWorkspaceFile(workspace.files, { path: dest, name: unique, isDirectory: false })
      }
    });
    await reloadWorkspace();
    return dest;
  },
  createWorkspaceFolder: async (parentPath, name) => {
    flushVisualEdits();
    flushSourceEdits();
    const workspace = get().workspace;
    if (!workspace?.root) throw new Error("Open a folder first");
    const folderName = name.trim();
    if (!isValidWorkspaceEntryName(folderName)) throw new Error("Enter a valid folder name");
    const unique = uniqueChildName(childNamesInFolder(workspace.files, parentPath, workspace.root), folderName);
    const dest = joinWorkspacePath(parentPath, unique);
    await getHost().files.mkdir(dest);
    set({
      workspace: {
        ...workspace,
        files: upsertWorkspaceFile(workspace.files, { path: dest, name: unique, isDirectory: true })
      }
    });
    await reloadWorkspace();
    return dest;
  },
  renameWorkspaceEntry: async (fromPath, newName) => {
    flushVisualEdits();
    flushSourceEdits();
    const workspace = get().workspace;
    if (!workspace?.root) throw new Error("Open a folder first");
    const nextName = newName.trim();
    if (!isValidWorkspaceEntryName(nextName)) throw new Error("Enter a valid name");
    const parent = workspaceParentPath(fromPath, workspace.root);
    const dest = joinWorkspacePath(parent, nextName);
    const destNorm = dest.replace(/\\/g, "/");
    const fromNorm = fromPath.replace(/\\/g, "/");
    if (destNorm === fromNorm) return fromPath;
    const currentName = workspaceEntryName(fromPath);
    const taken = childNamesInFolder(workspace.files, parent, workspace.root);
    if (taken.some((n) => n.toLowerCase() === nextName.toLowerCase() && n !== currentName)) {
      throw new Error("A file or folder with that name already exists");
    }
    await getHost().files.rename(fromPath, dest);
    const current = get().path;
    if (current) {
      const nextPath = rewriteWorkspacePath(current, fromPath, dest);
      if (nextPath !== current) {
        set({ path: nextPath, historyKey: historyKeyFromPath(nextPath, get().historyKey) });
      }
    }
    await reloadWorkspace();
    return dest;
  },
  copyWorkspaceEntry: async (fromPath, toParentPath) => {
    flushVisualEdits();
    flushSourceEdits();
    const workspace = get().workspace;
    if (!workspace?.root) throw new Error("Open a folder first");
    const name = fromPath.split(/[/\\]/).pop() || fromPath;
    const unique = uniqueChildName(childNamesInFolder(workspace.files, toParentPath, workspace.root), name);
    const dest = joinWorkspacePath(toParentPath, unique);
    await getHost().files.copy(fromPath, dest);
    await reloadWorkspace();
    return dest;
  },
  deleteWorkspaceEntry: async (targetPath) => {
    flushVisualEdits();
    flushSourceEdits();
    const workspace = get().workspace;
    if (!workspace?.root) throw new Error("Open a folder first");
    if (targetPath === workspace.root) throw new Error("Cannot delete the open folder");
    await getHost().files.remove(targetPath);
    const current = get().path;
    if (current && isPathOrDescendant(current, targetPath)) {
      get().newDocument();
    }
    await reloadWorkspace();
  },
  exportPdf: async () => {
    flushVisualEdits();
    flushSourceEdits();
    beginBusy({ kind: "export", label: "Preparing PDF…", blocking: true });
    await yieldPaint();
    try {
      const { model, path } = get();
      const host = getHost();
      const html = renderPrintDocument({
        ast: model.ast,
        mdoc: model.resolvedMdoc,
        title: displayDocumentTitle(model.frontmatter, path),
        subtitle: String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? ""),
        date: documentDate(model.frontmatter),
        filename: path ?? "document.md",
        runningInBody: false,
        pagedScriptUrl: webPagedScriptUrl(host.platform)
      });
      await host.export.pdf(html, {});
    } finally {
      set({ busy: null });
    }
  },
  exportHtml: async () => {
    flushVisualEdits();
    flushSourceEdits();
    beginBusy({ kind: "export", label: "Preparing HTML…", blocking: true });
    await yieldPaint();
    try {
      const { model, path } = get();
      const html = renderPrintDocument({
        ast: model.ast,
        mdoc: model.resolvedMdoc,
        title: displayDocumentTitle(model.frontmatter, path),
        subtitle: String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? ""),
        date: documentDate(model.frontmatter),
        filename: path ?? "document.md",
        runningInBody: false,
        pagedScriptUrl: webPagedScriptUrl(getHost().platform)
      });
      set({ busy: null });
      await getHost().files.saveAs(html, (path ?? "document").replace(/\.md$/, "") + ".html");
    } catch (error) {
      console.error("Could not export HTML", error);
      set({ busy: null });
    }
  },
  patchMdoc: (mdoc) => {
    const current = get().model;
    const frontmatter = { ...current.frontmatter, mdoc };
    let yaml = current.yamlCst;
    if (yaml) yaml.set("mdoc", mdoc);
    else yaml = parseDocument(`mdoc: {}\n`);
    const next = openDocument(serializedDocument({ ...current, yamlCst: yaml, frontmatter }), {
      workspaceMdoc: get().workspace?.workspaceMdoc
    });
    set({ model: next, dirty: true, syncGeneration: get().syncGeneration + 1, editGeneration: get().editGeneration + 1 });
  },
  patchFrontmatter: (patch) => {
    const next = setFrontmatterValues(get().model, patch, get().workspace?.workspaceMdoc);
    set({ model: next, dirty: true, editGeneration: get().editGeneration + 1 });
  },
  replaceFrontmatterModel: (model) => {
    set({ model, dirty: true, editGeneration: get().editGeneration + 1 });
  },
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, Math.round(zoom * 100) / 100)) }),
  toggleLeft: () => set({ leftOpen: !get().leftOpen }),
  toggleRight: () => set({ rightOpen: !get().rightOpen }),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setFind: (findOpen, query) => set({ findOpen, findQuery: query ?? get().findQuery }),
  saveDraft: async () => {
    flushVisualEdits();
    flushSourceEdits();
    const state = get();
    if (!state.dirty) return;
    try {
      const content = serializedDocument(state.model);
      await writeCrashDraft(content, {
        path: state.path,
        title: displayDocumentTitle(state.model.frontmatter, state.path)
      });
      set({ lastDraftAt: Date.now() });
    } catch (error) {
      console.error("Crash draft failed", error);
    }
  },
  restoreHistory: async (content) => {
    discardPendingVisual();
    discardPendingSource();
    beginBusy({ kind: "open", label: "Restoring…", blocking: true });
    await yieldPaint();
    try {
      const parsed = modelFrom(content, get().workspace?.workspaceMdoc);
      const cleaned = serializedDocument(parsed);
      const model = cleaned === content ? parsed : { ...modelFrom(cleaned, get().workspace?.workspaceMdoc), source: cleaned };
      set({
        model,
        dirty: cleaned !== get().lastSavedContent,
        syncGeneration: get().syncGeneration + 1,
        editGeneration: get().editGeneration + 1
      });
    } finally {
      if (get().view === "source") set({ busy: null });
    }
  },
  applyRecoveredDraft: async (content, path) => {
    discardPendingVisual();
    discardPendingSource();
    beginBusy({ kind: "open", label: "Restoring…", blocking: true });
    await yieldPaint();
    let lastSavedContent = get().lastSavedContent;
    if (path) {
      try {
        lastSavedContent = await getHost().files.read(path);
      } catch {
        /* keep the session baseline if the original file is unavailable */
      }
    }
    try {
      const parsed = modelFrom(content, get().workspace?.workspaceMdoc);
      const cleaned = serializedDocument(parsed);
      const model =
        cleaned === content ? parsed : { ...modelFrom(cleaned, get().workspace?.workspaceMdoc), source: cleaned };
      set({
        model,
        path,
        dirty: cleaned !== lastSavedContent,
        lastSavedContent,
        historyKey: historyKeyFromPath(path, get().historyKey),
        lastDraftAt: Date.now(),
        syncGeneration: get().syncGeneration + 1,
        editGeneration: get().editGeneration + 1
      });
    } finally {
      if (get().view === "source") set({ busy: null });
    }
    }
  };
});

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as Window & { __MDWORD_APP__?: typeof useApp }).__MDWORD_APP__ = useApp;
}
