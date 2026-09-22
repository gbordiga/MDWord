"use client";

import { create } from "zustand";
import {
  applyVisualDocument,
  composeWithYaml,
  openDocument,
  saveDocument,
  setFrontmatterValues,
  type DocumentModel
} from "@mdword/document-model";
import {
  displayDocumentTitle,
  documentDate,
  isMarkdownFileName,
  isNotAllowedError,
  suggestedPdfFileName,
  type ViewMode
} from "@mdword/shared";
import { pageMetrics, type Mdoc } from "@mdword/layout-engine";
import { parseDocument } from "yaml";
import { getHost } from "./host";
import { untitledDocument } from "./untitled";
import {
  emptyDocumentUndo,
  frontmatterUndoKind,
  mdocUndoKind,
  recordDocumentChange,
  redoDocumentChange,
  undoDocumentChange,
  type DocumentUndoState
} from "./documentUndo";
import { addHistorySnapshot, historyKeyFromPath, newUntitledHistoryKey } from "./documentHistory";
import { clearCrashDraft, writeCrashDraft } from "./recovery";
import {
  activeDocumentFields,
  commitOpenedWorkspaceTab,
  createTabFromOpen,
  createTabFromRestore,
  createUntitledTab,
  findTabByPath,
  neighborTabId,
  normalizeTabPath,
  pinDocumentTab,
  resolveWorkspaceTabOpen,
  snapshotActiveTab,
  type DocumentTab
} from "./documentTabs";
import {
  applySavedDocument,
  childNamesInFolder,
  isPathOrDescendant,
  isValidWorkspaceEntryName,
  indexWorkspace,
  joinWorkspacePath,
  listWorkspace,
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
import { rewriteDisplayBlobsInTree, tiptapToAst, visualProjection, type TiptapNode } from "@mdword/editor";
import { hydrateMermaidHtml, renderPrintDocument } from "@mdword/renderer";
import { resolveLeftPanel, type LeftPanel } from "./leftPanel";

export type OpenWorkspaceFileOptions = { preview?: boolean };
export type RibbonTab = "file" | "home" | "insert" | "layout" | "references" | "view" | "image" | "table" | "callout";
export type { LeftPanel } from "./leftPanel";
export { LEFT_PANELS, resolveLeftPanel } from "./leftPanel";
export type MobileSheet = "workspace" | "insert" | "properties" | "more" | null;
export type BusyKind = "open" | "save" | "folder" | "export" | "workspace";

export interface BusyState {
  kind: BusyKind;
  label: string;
  blocking: boolean;
}

const VISUAL_APPLY_MS = 160;
const SOURCE_APPLY_MS = 220;
let pendingTiptap: { doc: TiptapNode; tabId: string } | null = null;
let applyTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSource: { source: string; tabId: string } | null = null;
let sourceTimer: ReturnType<typeof setTimeout> | null = null;
let filePickerOpen = false;
let applyingDocumentUndo = false;
let workspaceEpoch = 0;
let draftWrite: Promise<void> | null = null;
let workspaceOpenSeq = 0;
const pendingWorkspaceOpens = new Map<string, { seq: number; preview: boolean }>();

async function withFilePicker<T>(run: () => Promise<T>): Promise<T | undefined> {
  if (filePickerOpen) return undefined;
  filePickerOpen = true;
  try {
    return await run();
  } finally {
    filePickerOpen = false;
  }
}

async function primeWrite(path?: string): Promise<void> {
  const host = getHost();
  if (typeof host.files.prepareWrite === "function") await host.files.prepareWrite(path);
}

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

async function preparePrintHtml(state: Pick<AppState, "model" | "path">): Promise<{
  html: string;
  suggestedName: string;
  path: string | null;
  pageWidthMicrons: number;
  pageHeightMicrons: number;
}> {
  const { model, path } = state;
  const host = getHost();
  const metrics = pageMetrics(model.resolvedMdoc);
  const html = await hydrateMermaidHtml(
    renderPrintDocument({
      ast: model.ast,
      mdoc: model.resolvedMdoc,
      title: displayDocumentTitle(model.frontmatter, path),
      subtitle: String(model.frontmatter.subtitle ?? model.frontmatter.sottotitolo ?? ""),
      date: documentDate(model.frontmatter),
      filename: path ?? "document.md",
      runningInBody: false,
      pagedScriptUrl: webPagedScriptUrl(host.platform)
    })
  );
  return {
    html,
    suggestedName: suggestedPdfFileName(model.frontmatter, path),
    path,
    pageWidthMicrons: Math.round(metrics.widthMm * 1000),
    pageHeightMicrons: Math.round(metrics.heightMm * 1000)
  };
}

export interface AppState {
  tabs: DocumentTab[];
  activeTabId: string;
  model: DocumentModel;
  path: string | null;
  dirty: boolean;
  view: ViewMode;
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
  documentUndo: DocumentUndoState;
  busy: BusyState | null;
  applySource: (source: string) => void;
  applyTiptap: (doc: TiptapNode) => void;
  setView: (view: ViewMode) => void;
  setRibbon: (tab: RibbonTab) => void;
  setLeft: (panel: LeftPanel) => void;
  newDocument: () => void;
  switchTab: (tabId: string) => void;
  pinTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  /** Save one tab. Returns false when the user cancels or the write fails. */
  saveTab: (tabId: string) => Promise<boolean>;
  /** Save every dirty tab. Returns false when any document is still dirty. */
  saveAllDirty: () => Promise<boolean>;
  openFolder: () => Promise<void>;
  openWorkspaceFile: (filePath: string, options?: OpenWorkspaceFileOptions) => Promise<void>;
  openWorkspaceFileByTitle: (title: string, options?: OpenWorkspaceFileOptions) => Promise<boolean>;
  refreshWorkspace: () => Promise<void>;
  createWorkspaceFile: (parentPath: string, name: string) => Promise<string>;
  createWorkspaceFolder: (parentPath: string, name: string) => Promise<string>;
  renameWorkspaceEntry: (fromPath: string, newName: string) => Promise<string>;
  copyWorkspaceEntry: (fromPath: string, toParentPath: string) => Promise<string>;
  deleteWorkspaceEntry: (targetPath: string) => Promise<void>;
  exportPdf: () => Promise<void>;
  printDocument: () => Promise<void>;
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
  undoDocument: () => boolean;
  redoDocument: () => boolean;
}

function modelFrom(source: string, workspaceMdoc?: Mdoc): DocumentModel {
  const model = openDocument(source, { workspaceMdoc });
  rewriteDisplayBlobsInTree(model.ast as { [key: string]: unknown });
  return model;
}

function serializedDocument(model: DocumentModel): string {
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
    const epoch = ++workspaceEpoch;
    try {
      const next = await loadWorkspace(getHost(), workspace.root);
      if (epoch !== workspaceEpoch) return;
      set({ workspace: next });
    } catch {
      /* keep the optimistic list if a re-list fails */
    }
  };

  const beginBusy = (busy: BusyState) => set({ busy });

  const patchActiveTab = (partial: Partial<DocumentTab>) => {
    const state = get();
    const nextPartial = partial.dirty === true ? { ...partial, preview: false } : partial;
    const tabs = state.tabs.map((tab) => (tab.id === state.activeTabId ? { ...tab, ...nextPartial } : tab));
    set({
      tabs,
      ...(partial.model !== undefined ? { model: partial.model } : {}),
      ...(partial.path !== undefined ? { path: partial.path } : {}),
      ...(partial.dirty !== undefined ? { dirty: partial.dirty } : {}),
      ...(partial.lastSavedAt !== undefined ? { lastSavedAt: partial.lastSavedAt } : {}),
      ...(partial.lastSavedContent !== undefined ? { lastSavedContent: partial.lastSavedContent } : {}),
      ...(partial.historyKey !== undefined ? { historyKey: partial.historyKey } : {}),
      ...(partial.syncGeneration !== undefined ? { syncGeneration: partial.syncGeneration } : {}),
      ...(partial.sourceGeneration !== undefined ? { sourceGeneration: partial.sourceGeneration } : {}),
      ...(partial.editGeneration !== undefined ? { editGeneration: partial.editGeneration } : {}),
      ...(partial.documentUndo !== undefined ? { documentUndo: partial.documentUndo } : {})
    });
  };

  const persistActiveTab = (): DocumentTab[] => snapshotActiveTab(get());

  const activateTab = (tab: DocumentTab, bumpSync = true) => {
    const nextTab = bumpSync ? { ...tab, syncGeneration: get().syncGeneration + 1 } : tab;
    const tabs = persistActiveTab().map((entry) => (entry.id === nextTab.id ? nextTab : entry));
    set({
      tabs,
      activeTabId: nextTab.id,
      ...activeDocumentFields(nextTab)
    });
  };

  const appendTab = (tab: DocumentTab) => {
    const nextTab = { ...tab, syncGeneration: get().syncGeneration + 1 };
    const tabs = [...persistActiveTab(), nextTab];
    set({
      tabs,
      activeTabId: nextTab.id,
      ...activeDocumentFields(nextTab)
    });
  };

  const commitTiptap = (doc: TiptapNode) => {
    try {
      const ast = tiptapToAst(doc);
      rewriteDisplayBlobsInTree(ast as { [key: string]: unknown });
      const current = get().model;
      const projection = visualProjection(current.ast);
      const next = applyVisualDocument(current, ast, {
        previous: projection.ast,
        origins: projection.origins,
        workspaceMdoc: get().workspace?.workspaceMdoc
      });
      if (next.source === current.source) return;
      const documentUndo = applyingDocumentUndo
        ? get().documentUndo
        : recordDocumentChange(get().documentUndo, current.source, next.source, "text");
      patchActiveTab({
        model: next,
        dirty: next.source !== get().lastSavedContent,
        editGeneration: get().editGeneration + 1,
        documentUndo
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
    const pending = pendingTiptap;
    pendingTiptap = null;
    if (pending && pending.tabId === get().activeTabId) commitTiptap(pending.doc);
  };

  const commitSource = (source: string) => {
    const previous = get().model.source;
    const model = modelFrom(source, get().workspace?.workspaceMdoc);
    if (model.source === previous) return;
    const documentUndo = applyingDocumentUndo
      ? get().documentUndo
      : recordDocumentChange(get().documentUndo, previous, model.source, "text");
    patchActiveTab({
      model,
      dirty: model.source !== get().lastSavedContent,
      sourceGeneration: get().sourceGeneration + 1,
      editGeneration: get().editGeneration + 1,
      documentUndo
    });
  };

  const applyRestoredSource = (source: string, documentUndo: DocumentUndoState) => {
    applyingDocumentUndo = true;
    try {
      const model = modelFrom(source, get().workspace?.workspaceMdoc);
      patchActiveTab({
        model,
        dirty: source !== get().lastSavedContent,
        syncGeneration: get().syncGeneration + 1,
        sourceGeneration: get().sourceGeneration + 1,
        editGeneration: get().editGeneration + 1,
        documentUndo
      });
    } finally {
      applyingDocumentUndo = false;
    }
  };

  const flushSourceEdits = () => {
    if (sourceTimer != null) {
      clearTimeout(sourceTimer);
      sourceTimer = null;
    }
    const pending = pendingSource;
    pendingSource = null;
    if (pending && pending.tabId === get().activeTabId) commitSource(pending.source);
  };

  const markSaved = (path: string, content: string, model: DocumentModel) => {
    const historyKey = historyKeyFromPath(path, get().historyKey);
    patchActiveTab({
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
  const initialTab = createUntitledTab(modelFrom(initialSource), initialSource);

  return {
  tabs: [initialTab],
  activeTabId: initialTab.id,
  model: initialTab.model,
  path: initialTab.path,
  dirty: initialTab.dirty,
  view: "document",
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
  lastSavedAt: initialTab.lastSavedAt,
  lastDraftAt: null,
  lastSavedContent: initialTab.lastSavedContent,
  historyKey: initialTab.historyKey,
  documentUndo: initialTab.documentUndo,
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
    pendingSource = { source, tabId: get().activeTabId };
    if (sourceTimer != null) return;
    sourceTimer = setTimeout(() => {
      sourceTimer = null;
      flushSourceEdits();
    }, SOURCE_APPLY_MS);
  },
  applyTiptap: (doc) => {
    pendingTiptap = { doc, tabId: get().activeTabId };
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
  setRibbon: (ribbon) => set({ ribbon }),
  setLeft: (left) => {
    const panel = resolveLeftPanel(left);
    const compact = typeof window !== "undefined" && window.innerWidth < 1024;
    set(compact ? { left: panel, mobileSheet: "workspace" } : { left: panel, leftOpen: true });
  },
  newDocument: () => {
    discardPendingVisual();
    discardPendingSource();
    void clearCrashDraft();
    appendTab(createUntitledTab(modelFrom(untitledDocument()), untitledDocument()));
  },
  switchTab: (tabId) => {
    if (tabId === get().activeTabId) return;
    flushVisualEdits();
    flushSourceEdits();
    discardPendingVisual();
    discardPendingSource();
    const tab = persistActiveTab().find((entry) => entry.id === tabId);
    if (!tab) return;
    activateTab(tab);
    discardPendingVisual();
    discardPendingSource();
  },
  pinTab: (tabId) => {
    const tabs = persistActiveTab();
    const current = tabs.find((tab) => tab.id === tabId);
    if (!current?.preview) return;
    set({ tabs: pinDocumentTab(tabs, tabId) });
  },
  closeTab: (tabId) => {
    flushVisualEdits();
    flushSourceEdits();
    discardPendingVisual();
    discardPendingSource();
    let tabs = persistActiveTab();
    const closing = tabs.find((tab) => tab.id === tabId);
    if (!closing) return;
    const nextId = tabId === get().activeTabId ? neighborTabId(tabs, tabId) : null;
    tabs = tabs.filter((tab) => tab.id !== tabId);
    if (!tabs.length) {
      void clearCrashDraft();
      const fresh = createUntitledTab(modelFrom(untitledDocument()), untitledDocument());
      set({
        tabs: [fresh],
        activeTabId: fresh.id,
        ...activeDocumentFields(fresh)
      });
      return;
    }
    if (tabId === get().activeTabId) {
      const nextTab = tabs.find((tab) => tab.id === nextId) ?? tabs[0];
      if (!nextTab) return;
      set({ tabs });
      activateTab(nextTab);
      return;
    }
    set({ tabs });
  },
  openFile: async () => {
    const result = await withFilePicker(async () => {
      try {
        return await getHost().files.open();
      } catch (error) {
        console.error("Could not open document", error);
        return null;
      }
    });
    if (!result) return;
    discardPendingVisual();
    discardPendingSource();
    const existing = findTabByPath(get().tabs, result.path);
    if (existing) {
      get().switchTab(existing.id);
      return;
    }
    beginBusy({ kind: "open", label: "Opening document…", blocking: true });
    await yieldPaint();
    try {
      const model = modelFrom(result.content, get().workspace?.workspaceMdoc);
      void clearCrashDraft();
      const revealed = {
        ...createTabFromOpen(result.path, result.content, model, get().historyKey),
        syncGeneration: get().syncGeneration + 1
      };
      set({
        tabs: commitOpenedWorkspaceTab(persistActiveTab(), revealed, null),
        activeTabId: revealed.id,
        ...activeDocumentFields(revealed),
        busy: null
      });
      await yieldPaint();
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
      const next = await withFilePicker(async () => {
        try {
          return await host.files.saveAs(content, "document.md");
        } catch (error) {
          console.error("Could not save document", error);
          return null;
        }
      });
      if (!next) return;
      beginBusy({ kind: "save", label: "Saving…", blocking: false });
      try {
        markSaved(next, content, model);
      } finally {
        set({ busy: null });
      }
      return;
    }
    beginBusy({ kind: "save", label: "Saving…", blocking: false });
    try {
      await primeWrite(path);
      await yieldPaint();
      await host.files.save({ path, content });
      markSaved(path, content, model);
    } catch (error) {
      if (isNotAllowedError(error)) {
        const next = await withFilePicker(async () => {
          try {
            return await host.files.saveAs(content, path);
          } catch (fallback) {
            console.error("Could not save document", fallback);
            return null;
          }
        });
        if (next) {
          markSaved(next, content, model);
        }
      } else {
        console.error("Could not save document", error);
      }
    } finally {
      set({ busy: null });
    }
  },
  saveFileAs: async () => {
    flushVisualEdits();
    flushSourceEdits();
    const content = serializedDocument(get().model);
    const next = await withFilePicker(async () => {
      try {
        return await getHost().files.saveAs(content, get().path ?? "document.md");
      } catch (error) {
        console.error("Could not save document", error);
        return null;
      }
    });
    if (!next) return;
    beginBusy({ kind: "save", label: "Saving…", blocking: false });
    try {
      markSaved(next, content, get().model);
    } finally {
      set({ busy: null });
    }
  },
  saveTab: async (tabId) => {
    flushVisualEdits();
    flushSourceEdits();
    const tab = persistActiveTab().find((entry) => entry.id === tabId);
    if (!tab?.dirty) return true;
    if (get().activeTabId !== tabId) activateTab(tab);
    await get().saveFile();
    return !persistActiveTab().some((entry) => entry.id === tabId && entry.dirty);
  },
  saveAllDirty: async () => {
    flushVisualEdits();
    flushSourceEdits();
    const dirty = persistActiveTab().filter((tab) => tab.dirty);
    const ordered = [...dirty.filter((tab) => tab.path), ...dirty.filter((tab) => !tab.path)];
    for (const tab of ordered) {
      const saved = await get().saveTab(tab.id);
      if (!saved) return false;
    }
    return true;
  },
  openFolder: async () => {
    const root = await withFilePicker(async () => {
      try {
        return await getHost().files.openFolder();
      } catch (error) {
        console.error("Could not open folder", error);
        return null;
      }
    });
    if (!root) return;
    const epoch = ++workspaceEpoch;
    beginBusy({ kind: "folder", label: "Opening folder…", blocking: true });
    await yieldPaint();
    try {
      const listed = await listWorkspace(getHost(), root);
      if (epoch !== workspaceEpoch) return;
      set({
        workspace: listed,
        busy: { kind: "folder", label: "Indexing workspace…", blocking: false }
      });
      await yieldPaint();
      const workspace = await indexWorkspace(getHost(), listed);
      if (epoch !== workspaceEpoch) return;
      set({ workspace, busy: null });
    } catch (error) {
      console.error("Could not open folder", error);
      if (epoch === workspaceEpoch) set({ busy: null });
    }
  },
  openWorkspaceFile: async (filePath, options) => {
    flushVisualEdits();
    flushSourceEdits();
    discardPendingVisual();
    discardPendingSource();
    const previewRequested = options?.preview === true;
    const mode = previewRequested ? "preview" : "pinned";
    const early = resolveWorkspaceTabOpen(persistActiveTab(), filePath, mode);
    if (early.existingId) {
      set({ tabs: early.tabs, mobileSheet: null });
      get().switchTab(early.existingId);
      return;
    }
    const normalized = normalizeTabPath(filePath);
    const seq = ++workspaceOpenSeq;
    const prev = pendingWorkspaceOpens.get(normalized);
    const preview = prev?.preview === false ? false : previewRequested;
    pendingWorkspaceOpens.set(normalized, { seq, preview });
    const host = getHost();
    beginBusy({ kind: "workspace", label: "Opening document…", blocking: true });
    await yieldPaint();
    try {
      const result = await host.files.openPath(filePath);
      const pending = pendingWorkspaceOpens.get(normalized);
      if (!pending || pending.seq !== seq) return;
      pendingWorkspaceOpens.delete(normalized);
      const plan = resolveWorkspaceTabOpen(
        persistActiveTab(),
        result.path,
        pending.preview ? "preview" : "pinned"
      );
      void clearCrashDraft();
      if (plan.existingId) {
        set({ tabs: plan.tabs, mobileSheet: null, busy: null });
        get().switchTab(plan.existingId);
        await yieldPaint();
        return;
      }
      const nextTab = createTabFromOpen(
        result.path,
        result.content,
        modelFrom(result.content, get().workspace?.workspaceMdoc),
        get().historyKey,
        pending.preview
      );
      const revealed = { ...nextTab, syncGeneration: get().syncGeneration + 1 };
      set({
        tabs: commitOpenedWorkspaceTab(persistActiveTab(), revealed, plan.replaceId),
        activeTabId: revealed.id,
        mobileSheet: null,
        busy: null,
        ...activeDocumentFields(revealed)
      });
      discardPendingVisual();
      discardPendingSource();
      await yieldPaint();
    } catch {
      if (pendingWorkspaceOpens.get(normalized)?.seq === seq) {
        pendingWorkspaceOpens.delete(normalized);
        set({ busy: null });
      }
    }
  },
  openWorkspaceFileByTitle: async (title, options) => {
    const { workspace, path } = get();
    if (!workspace) return false;
    const resolved = resolveWikiTarget(workspace.index, path ?? "", title);
    if (!resolved) return false;
    await get().openWorkspaceFile(resolved, options);
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
    await primeWrite(dest);
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
    await primeWrite(dest);
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
    await primeWrite(fromPath);
    await getHost().files.rename(fromPath, dest);
    const tabs = persistActiveTab().map((tab) => {
      if (!tab.path) return tab;
      const nextPath = rewriteWorkspacePath(tab.path, fromPath, dest);
      if (nextPath === tab.path) return tab;
      return { ...tab, path: nextPath, historyKey: historyKeyFromPath(nextPath, tab.historyKey) };
    });
    const active = tabs.find((tab) => tab.id === get().activeTabId);
    set({
      tabs,
      ...(active
        ? { path: active.path, historyKey: active.historyKey }
        : {})
    });
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
    await primeWrite(fromPath);
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
    await primeWrite(targetPath);
    await getHost().files.remove(targetPath);
    let tabs = persistActiveTab();
    const closingIds = tabs
      .filter((tab) => tab.path && isPathOrDescendant(tab.path, targetPath))
      .map((tab) => tab.id);
    for (const tabId of closingIds) {
      tabs = tabs.filter((tab) => tab.id !== tabId);
    }
    if (!tabs.length) {
      const fresh = createUntitledTab(modelFrom(untitledDocument()), untitledDocument());
      set({ tabs: [fresh], activeTabId: fresh.id, ...activeDocumentFields(fresh) });
    } else if (!tabs.some((tab) => tab.id === get().activeTabId)) {
      const nextTab = tabs[0];
      if (nextTab) {
        set({ tabs });
        activateTab(nextTab);
      }
    } else {
      set({ tabs });
    }
    await reloadWorkspace();
  },
  exportPdf: async () => {
    flushVisualEdits();
    flushSourceEdits();
    beginBusy({ kind: "export", label: "Preparing PDF…", blocking: true });
    await yieldPaint();
    try {
      const prepared = await preparePrintHtml(get());
      await getHost().export.pdf(prepared.html, {
        suggestedName: prepared.suggestedName,
        sourcePath: prepared.path
      });
    } finally {
      set({ busy: null });
    }
  },
  printDocument: async () => {
    if (get().busy?.blocking) return;
    beginBusy({ kind: "export", label: "Preparing print…", blocking: true });
    flushVisualEdits();
    flushSourceEdits();
    await yieldPaint();
    try {
      const prepared = await preparePrintHtml(get());
      await getHost().export.print(prepared.html, {
        suggestedName: prepared.suggestedName,
        pageWidthMicrons: prepared.pageWidthMicrons,
        pageHeightMicrons: prepared.pageHeightMicrons
      });
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
      const prepared = await preparePrintHtml(get());
      set({ busy: null });
      await getHost().files.saveAs(
        prepared.html,
        (prepared.path ?? "document").replace(/\.md$/, "") + ".html"
      );
    } catch (error) {
      console.error("Could not export HTML", error);
      set({ busy: null });
    }
  },
  patchMdoc: (mdoc) => {
    const current = get().model;
    let yaml = current.yamlCst;
    if (yaml) yaml.set("mdoc", mdoc);
    else {
      yaml = parseDocument(`mdoc: {}\n`);
      yaml.set("mdoc", mdoc);
    }
    const next = openDocument(composeWithYaml(yaml, current.body, Boolean(current.head)), {
      workspaceMdoc: get().workspace?.workspaceMdoc
    });
    if (next.source === current.source) return;
    patchActiveTab({
      model: next,
      dirty: next.source !== get().lastSavedContent,
      syncGeneration: get().syncGeneration + 1,
      editGeneration: get().editGeneration + 1,
      documentUndo: recordDocumentChange(
        get().documentUndo,
        current.source,
        next.source,
        mdocUndoKind(current.mdoc, mdoc)
      )
    });
  },
  patchFrontmatter: (patch) => {
    const current = get().model;
    const next = setFrontmatterValues(current, patch, get().workspace?.workspaceMdoc);
    if (next.source === current.source) return;
    patchActiveTab({
      model: next,
      dirty: next.source !== get().lastSavedContent,
      editGeneration: get().editGeneration + 1,
      documentUndo: recordDocumentChange(
        get().documentUndo,
        current.source,
        next.source,
        frontmatterUndoKind(patch)
      )
    });
  },
  replaceFrontmatterModel: (model) => {
    const current = get().model;
    if (model.source === current.source) return;
    patchActiveTab({
      model,
      dirty: (model.source ?? "") !== get().lastSavedContent,
      editGeneration: get().editGeneration + 1,
      documentUndo: recordDocumentChange(get().documentUndo, current.source, model.source ?? "", "frontmatter")
    });
  },
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, Math.round(zoom * 100) / 100)) }),
  toggleLeft: () => set({ leftOpen: !get().leftOpen }),
  toggleRight: () => set({ rightOpen: !get().rightOpen }),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setFind: (findOpen, query) => set({ findOpen, findQuery: query ?? get().findQuery }),
  saveDraft: async () => {
    if (draftWrite) return;
    const state = get();
    if (!state.dirty || state.busy?.kind === "save") return;
    flushVisualEdits();
    flushSourceEdits();
    const next = get();
    if (!next.dirty || next.busy?.kind === "save") return;
    draftWrite = (async () => {
      try {
        const content = serializedDocument(next.model);
        await writeCrashDraft(content, {
          path: next.path,
          title: displayDocumentTitle(next.model.frontmatter, next.path)
        });
        set({ lastDraftAt: Date.now() });
      } catch (error) {
        console.error("Crash draft failed", error);
      }
    })().finally(() => {
      draftWrite = null;
    });
    await draftWrite;
  },
  undoDocument: () => {
    flushVisualEdits();
    flushSourceEdits();
    const current = get().model.source;
    const next = undoDocumentChange(get().documentUndo, current);
    if (!next) return false;
    applyRestoredSource(next.source, next.state);
    return true;
  },
  redoDocument: () => {
    flushVisualEdits();
    flushSourceEdits();
    const current = get().model.source;
    const next = redoDocumentChange(get().documentUndo, current);
    if (!next) return false;
    applyRestoredSource(next.source, next.state);
    return true;
  },
  restoreHistory: async (content) => {
    discardPendingVisual();
    discardPendingSource();
    beginBusy({ kind: "open", label: "Restoring…", blocking: true });
    await yieldPaint();
    try {
      const model = modelFrom(content, get().workspace?.workspaceMdoc);
      patchActiveTab({
        model,
        dirty: content !== get().lastSavedContent,
        syncGeneration: get().syncGeneration + 1,
        editGeneration: get().editGeneration + 1,
        documentUndo: emptyDocumentUndo()
      });
    } finally {
      set({ busy: null });
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
      const model = modelFrom(content, get().workspace?.workspaceMdoc);
      appendTab(
        createTabFromRestore(
          model,
          path,
          lastSavedContent,
          content !== lastSavedContent,
          get().historyKey
        )
      );
      set({ lastDraftAt: Date.now() });
    } finally {
      set({ busy: null });
    }
    }
  };
});

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as Window & { __MDWORD_APP__?: typeof useApp }).__MDWORD_APP__ = useApp;
}
