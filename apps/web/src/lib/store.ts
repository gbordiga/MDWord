"use client";

import { create } from "zustand";
import {
  openDocument,
  saveDocument,
  type DocumentModel
} from "@mdword/document-model";
import { displayDocumentTitle, documentDate, type ViewMode } from "@mdword/shared";
import type { Mdoc } from "@mdword/layout-engine";
import { parseDocument } from "yaml";
import { getHost } from "./host";
import { untitledDocument } from "./untitled";
import { loadWorkspace, applySavedDocument, resolveWikiTarget, type WorkspaceState } from "@mdword/workspace";
import { tiptapToAst, type TiptapNode } from "@mdword/editor";
import { renderPrintDocument } from "@mdword/renderer";

export type RibbonTab = "file" | "home" | "insert" | "layout" | "references" | "view";
export type LeftPanel = "files" | "outline" | "search" | "backlinks";
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

/** Safari/iOS already honor @page margin boxes; Chromium needs the Paged.js polyfill. */
function webPagedScriptUrl(platform: string): string | undefined {
  if (typeof window === "undefined" || platform !== "web") return undefined;
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS/i.test(ua)) return undefined;
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) return undefined;
  return `${window.location.origin}/paged.polyfill.min.js`;
}

interface AppState {
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
  editGeneration: number;
  lastSavedAt: number | null;
  lastDraftAt: number | null;
  busy: BusyState | null;
  applySource: (source: string) => void;
  applyTiptap: (doc: TiptapNode) => void;
  setView: (view: ViewMode) => void;
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
  setZoom: (zoom: number) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setMobileSheet: (sheet: MobileSheet) => void;
  setPalette: (open: boolean) => void;
  setFind: (open: boolean, query?: string) => void;
  finishBusy: (kinds?: BusyKind[]) => void;
  autosave: () => Promise<void>;
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

  return {
  model: modelFrom(untitledDocument()),
  path: null,
  dirty: false,
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
  editGeneration: 0,
  lastSavedAt: null,
  lastDraftAt: null,
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
  setRibbon: (ribbon) => set({ ribbon }),
  setLeft: (left) => {
    const compact = typeof window !== "undefined" && window.innerWidth < 1024;
    set(compact ? { left, mobileSheet: "workspace" } : { left, leftOpen: true });
  },
  newDocument: () =>
    set({
      model: modelFrom(untitledDocument()),
      path: null,
      dirty: false,
      lastSavedAt: null,
      lastDraftAt: null,
      syncGeneration: get().syncGeneration + 1
    }),
  openFile: async () => {
    const host = getHost();
    const result = await host.files.open();
    if (!result) return;
    beginBusy({ kind: "open", label: "Opening document…", blocking: true });
    await yieldPaint();
    try {
      const model = modelFrom(result.content, get().workspace?.workspaceMdoc);
      set({
        model,
        path: result.path,
        dirty: false,
        lastSavedAt: Date.now(),
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
        set({ path: next, dirty: false, model: { ...model, source: content }, lastSavedAt: Date.now() });
        rememberSavedFile(next, content);
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
      set({ dirty: false, model: { ...model, source: content }, lastSavedAt: Date.now() });
      rememberSavedFile(path, content);
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
      set({ path: next, dirty: false, lastSavedAt: Date.now() });
      rememberSavedFile(next, content);
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
      set({
        model: modelFrom(result.content, get().workspace?.workspaceMdoc),
        path: result.path,
        dirty: false,
        lastSavedAt: Date.now(),
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
        runningInBody: host.platform === "web",
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
        runningInBody: true
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
    const current = get().model;
    const frontmatter = { ...current.frontmatter, ...patch };
    const yaml = current.yamlCst;
    if (yaml) {
      for (const [k, v] of Object.entries(patch)) yaml.set(k, v);
    }
    const next = openDocument(saveDocument({ ...current, frontmatter, yamlCst: yaml }), {
      workspaceMdoc: get().workspace?.workspaceMdoc
    });
    set({ model: next, dirty: true, syncGeneration: get().syncGeneration + 1, editGeneration: get().editGeneration + 1 });
  },
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, Math.round(zoom * 100) / 100)) }),
  toggleLeft: () => set({ leftOpen: !get().leftOpen }),
  toggleRight: () => set({ rightOpen: !get().rightOpen }),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setFind: (findOpen, query) => set({ findOpen, findQuery: query ?? get().findQuery }),
  autosave: async () => {
    const state = get();
    if (!state.dirty) return;
    if (state.busy) return;
    const host = getHost();
    const content = saveDocument(state.model);
    beginBusy({ kind: "save", label: "Saving…", blocking: false });
    try {
      await host.app.writeRecovery("current", content, {
        path: state.path,
        updatedMs: Date.now()
      });
      set({ lastDraftAt: Date.now() });
      if (state.path && (await host.files.canWrite(state.path))) {
        await host.files.save({ path: state.path, content });
        rememberSavedFile(state.path, content);
        set({
          dirty: false,
          model: { ...state.model, source: content },
          lastSavedAt: Date.now()
        });
      }
    } catch (error) {
      console.error("Autosave failed", error);
    } finally {
      set({ busy: null });
    }
  }
  };
});
