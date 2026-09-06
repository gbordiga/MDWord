"use client";

import { create } from "zustand";
import {
  openDocument,
  saveDocument,
  type DocumentModel
} from "@mdword/document-model";
import { displayDocumentTitle, type ViewMode } from "@mdword/shared";
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
  applySource: (source) => {
    const model = modelFrom(source, get().workspace?.workspaceMdoc);
    set({ model, dirty: true, syncGeneration: get().syncGeneration + 1 });
  },
  applyTiptap: (doc) => {
    try {
      const ast = tiptapToAst(doc);
      const current = get().model;
      const next: DocumentModel = { ...current, ast };
      const source = saveDocument(next);
      set({
        model: { ...openDocument(source, { workspaceMdoc: get().workspace?.workspaceMdoc }), ast },
        dirty: true
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
      syncGeneration: get().syncGeneration + 1
    }),
  openFile: async () => {
    const host = getHost();
    const result = await host.files.open();
    if (!result) return;
    set({
      model: modelFrom(result.content, get().workspace?.workspaceMdoc),
      path: result.path,
      dirty: false,
      syncGeneration: get().syncGeneration + 1
    });
  },
  saveFile: async () => {
    const host = getHost();
    const { model, path } = get();
    const content = saveDocument(model);
    if (!path) {
      const next = await host.files.saveAs(content, "document.md");
      if (next) {
        set({ path: next, dirty: false, model: { ...model, source: content } });
        rememberSavedFile(next, content);
        await reloadWorkspace();
      }
      return;
    }
    await host.files.save({ path, content });
    set({ dirty: false, model: { ...model, source: content } });
    rememberSavedFile(path, content);
    await reloadWorkspace();
  },
  saveFileAs: async () => {
    const host = getHost();
    const content = saveDocument(get().model);
    const next = await host.files.saveAs(content, get().path ?? "document.md");
    if (next) {
      set({ path: next, dirty: false });
      rememberSavedFile(next, content);
      await reloadWorkspace();
    }
  },
  openFolder: async () => {
    const host = getHost();
    const root = await host.files.openFolder();
    if (!root) return;
    const workspace = await loadWorkspace(host, root);
    set({ workspace });
  },
  openWorkspaceFile: async (filePath) => {
    const host = getHost();
    try {
      const result = await host.files.openPath(filePath);
      set({
        model: modelFrom(result.content, get().workspace?.workspaceMdoc),
        path: result.path,
        dirty: false,
        syncGeneration: get().syncGeneration + 1,
        mobileSheet: null
      });
    } catch {
      /* file handle may be missing on web until the folder is re-listed */
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
    const { model, path } = get();
    const html = renderPrintDocument({
      ast: model.ast,
      mdoc: model.resolvedMdoc,
      title: displayDocumentTitle(model.frontmatter, path),
      date: String(model.frontmatter.date ?? ""),
      filename: path ?? "document.md"
    });
    await getHost().export.pdf(html, {});
  },
  exportHtml: async () => {
    const { model, path } = get();
    const html = renderPrintDocument({
      ast: model.ast,
      mdoc: model.resolvedMdoc,
      title: displayDocumentTitle(model.frontmatter, path),
      filename: path ?? "document.md"
    });
    await getHost().files.saveAs(html, (path ?? "document").replace(/\.md$/, "") + ".html");
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
    set({ model: next, dirty: true, syncGeneration: get().syncGeneration + 1 });
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
    set({ model: next, dirty: true, syncGeneration: get().syncGeneration + 1 });
  },
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, zoom)) }),
  toggleLeft: () => set({ leftOpen: !get().leftOpen }),
  toggleRight: () => set({ rightOpen: !get().rightOpen }),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setFind: (findOpen, query) => set({ findOpen, findQuery: query ?? get().findQuery })
  };
});
