"use client";

import { create } from "zustand";
import {
  openDocument,
  saveDocument,
  setFrontmatterValues,
  type DocumentModel
} from "@mdword/document-model";
import { displayDocumentTitle, documentDate, type ViewMode } from "@mdword/shared";
import type { Mdoc } from "@mdword/layout-engine";
import { parseDocument } from "yaml";
import { getHost } from "./host";
import { untitledDocument } from "./untitled";
import { addHistorySnapshot, historyKeyFromPath, newUntitledHistoryKey } from "./documentHistory";
import { clearCrashDraft, writeCrashDraft } from "./recovery";
import { loadWorkspace, applySavedDocument, resolveWikiTarget, type WorkspaceState } from "@mdword/workspace";
import { tiptapToAst, type TiptapNode } from "@mdword/editor";
import { renderPrintDocument } from "@mdword/renderer";

export type RibbonTab = "file" | "home" | "insert" | "layout" | "references" | "view";
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

interface AppState {
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
  saveDraft: () => Promise<void>;
  restoreHistory: (content: string) => void;
  applyRecoveredDraft: (content: string, path: string | null) => Promise<void>;
}

function modelFrom(source: string, workspaceMdoc?: Mdoc): DocumentModel {
  return openDocument(source, { workspaceMdoc });
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
  editGeneration: 0,
  lastSavedAt: null,
  lastDraftAt: null,
  lastSavedContent: initialSource,
  historyKey: newUntitledHistoryKey(),
  busy: null,
  finishBusy: (kinds) => {
    const busy = get().busy;
    if (!busy) return;
    if (!kinds || kinds.includes(busy.kind)) set({ busy: null });
  },
  applySource: (source) => {
    const model = modelFrom(source, get().workspace?.workspaceMdoc);
    set({ model, dirty: true, syncGeneration: get().syncGeneration + 1, editGeneration: get().editGeneration + 1 });
  },
  applyTiptap: (doc) => {
    try {
      const ast = tiptapToAst(doc);
      const current = get().model;
      const next: DocumentModel = { ...current, ast };
      const source = saveDocument(next);
      set({
        model: { ...openDocument(source, { workspaceMdoc: get().workspace?.workspaceMdoc }), ast },
        dirty: true,
        editGeneration: get().editGeneration + 1
      });
    } catch (error) {
      console.error("Could not apply visual edits", error);
    }
  },
  setView: (view) => set({ view }),
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
    const host = getHost();
    const { model, path } = get();
    const content = saveDocument(model);
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
    const host = getHost();
    const content = saveDocument(get().model);
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
  exportPdf: async () => {
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
    const next = openDocument(saveDocument({ ...current, yamlCst: yaml, frontmatter }), {
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
    const state = get();
    if (!state.dirty) return;
    try {
      const content = saveDocument(state.model);
      await writeCrashDraft(content, {
        path: state.path,
        title: displayDocumentTitle(state.model.frontmatter, state.path)
      });
      set({ lastDraftAt: Date.now() });
    } catch (error) {
      console.error("Crash draft failed", error);
    }
  },
  restoreHistory: (content) => {
    const model = modelFrom(content, get().workspace?.workspaceMdoc);
    set({
      model,
      dirty: content !== get().lastSavedContent,
      syncGeneration: get().syncGeneration + 1,
      editGeneration: get().editGeneration + 1
    });
  },
  applyRecoveredDraft: async (content, path) => {
    let lastSavedContent = get().lastSavedContent;
    if (path) {
      try {
        lastSavedContent = await getHost().files.read(path);
      } catch {
        /* keep the session baseline if the original file is unavailable */
      }
    }
    const model = modelFrom(content, get().workspace?.workspaceMdoc);
    set({
      model,
      path,
      dirty: content !== lastSavedContent,
      lastSavedContent,
      historyKey: historyKeyFromPath(path, get().historyKey),
      lastDraftAt: Date.now(),
      syncGeneration: get().syncGeneration + 1,
      editGeneration: get().editGeneration + 1
    });
  }
  };
});
