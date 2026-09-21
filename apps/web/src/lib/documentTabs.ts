import type { DocumentModel } from "@mdword/document-model";
import { displayDocumentTitle } from "@mdword/shared";
import { historyKeyFromPath, newUntitledHistoryKey } from "./documentHistory";
import { untitledDocument } from "./untitled";

export interface DocumentTab {
  id: string;
  path: string | null;
  model: DocumentModel;
  dirty: boolean;
  preview: boolean;
  lastSavedAt: number | null;
  lastSavedContent: string;
  historyKey: string;
  syncGeneration: number;
  sourceGeneration: number;
  editGeneration: number;
}

export type WorkspaceTabOpenMode = "preview" | "pinned";

export type WorkspaceTabOpenPlan =
  | { existingId: string; tabs: DocumentTab[]; replaceId: null }
  | { existingId: null; tabs: DocumentTab[]; replaceId: string | null };

export function newTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function tabTitle(tab: Pick<DocumentTab, "model" | "path">): string {
  return displayDocumentTitle(tab.model.frontmatter, tab.path);
}

export function normalizeTabPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function findTabByPath(tabs: DocumentTab[], filePath: string): DocumentTab | undefined {
  const target = normalizeTabPath(filePath);
  return tabs.find((tab) => tab.path && normalizeTabPath(tab.path) === target);
}

export function activeDocumentFields(tab: DocumentTab): {
  model: DocumentModel;
  path: string | null;
  dirty: boolean;
  lastSavedAt: number | null;
  lastSavedContent: string;
  historyKey: string;
  syncGeneration: number;
  sourceGeneration: number;
  editGeneration: number;
} {
  return {
    model: tab.model,
    path: tab.path,
    dirty: tab.dirty,
    lastSavedAt: tab.lastSavedAt,
    lastSavedContent: tab.lastSavedContent,
    historyKey: tab.historyKey,
    syncGeneration: tab.syncGeneration,
    sourceGeneration: tab.sourceGeneration,
    editGeneration: tab.editGeneration
  };
}

export function snapshotActiveTab(state: {
  activeTabId: string;
  tabs: DocumentTab[];
  model: DocumentModel;
  path: string | null;
  dirty: boolean;
  lastSavedAt: number | null;
  lastSavedContent: string;
  historyKey: string;
  syncGeneration: number;
  sourceGeneration: number;
  editGeneration: number;
}): DocumentTab[] {
  return state.tabs.map((tab) =>
    tab.id === state.activeTabId
      ? {
          ...tab,
          model: state.model,
          path: state.path,
          dirty: state.dirty,
          lastSavedAt: state.lastSavedAt,
          lastSavedContent: state.lastSavedContent,
          historyKey: state.historyKey,
          syncGeneration: state.syncGeneration,
          sourceGeneration: state.sourceGeneration,
          editGeneration: state.editGeneration
        }
      : tab
  );
}

export function createUntitledTab(model: DocumentModel, source = untitledDocument()): DocumentTab {
  return {
    id: newTabId(),
    path: null,
    model,
    dirty: false,
    preview: false,
    lastSavedAt: null,
    lastSavedContent: source,
    historyKey: newUntitledHistoryKey(),
    syncGeneration: 0,
    sourceGeneration: 0,
    editGeneration: 0
  };
}

export function createTabFromOpen(
  path: string,
  content: string,
  model: DocumentModel,
  historyKeySeed: string,
  preview = false
): DocumentTab {
  return {
    id: newTabId(),
    path,
    model,
    dirty: false,
    preview,
    lastSavedAt: Date.now(),
    lastSavedContent: content,
    historyKey: historyKeyFromPath(path, historyKeySeed),
    syncGeneration: 0,
    sourceGeneration: 0,
    editGeneration: 0
  };
}

export function createTabFromRestore(
  model: DocumentModel,
  path: string | null,
  lastSavedContent: string,
  dirty: boolean,
  historyKeySeed: string
): DocumentTab {
  return {
    id: newTabId(),
    path,
    model,
    dirty,
    preview: false,
    lastSavedAt: null,
    lastSavedContent,
    historyKey: historyKeyFromPath(path, historyKeySeed),
    syncGeneration: 0,
    sourceGeneration: 0,
    editGeneration: 0
  };
}

export function neighborTabId(tabs: DocumentTab[], closingId: string): string | null {
  const index = tabs.findIndex((tab) => tab.id === closingId);
  if (index < 0) return tabs[0]?.id ?? null;
  const next = tabs[index + 1] ?? tabs[index - 1];
  return next?.id ?? null;
}

export function findPreviewTab(tabs: DocumentTab[]): DocumentTab | undefined {
  return tabs.find((tab) => tab.preview);
}

export function pinDocumentTab(tabs: DocumentTab[], tabId: string): DocumentTab[] {
  return tabs.map((tab) => (tab.id === tabId && tab.preview ? { ...tab, preview: false } : tab));
}

export function resolveWorkspaceTabOpen(
  tabs: DocumentTab[],
  filePath: string,
  mode: WorkspaceTabOpenMode
): WorkspaceTabOpenPlan {
  const existing = findTabByPath(tabs, filePath);
  if (existing) {
    return {
      existingId: existing.id,
      tabs: mode === "pinned" ? pinDocumentTab(tabs, existing.id) : tabs,
      replaceId: null
    };
  }
  if (mode !== "preview") {
    return { existingId: null, tabs, replaceId: null };
  }
  const previewTab = findPreviewTab(tabs);
  const replaceable = previewTab && !previewTab.dirty ? previewTab : undefined;
  return { existingId: null, tabs, replaceId: replaceable?.id ?? null };
}

export function commitOpenedWorkspaceTab(
  tabs: DocumentTab[],
  nextTab: DocumentTab,
  replaceId: string | null
): DocumentTab[] {
  if (replaceId) {
    return tabs.map((tab) => (tab.id === replaceId ? nextTab : tab));
  }
  const leftoverDirtyPreview =
    nextTab.preview ? tabs.find((tab) => tab.preview && tab.dirty) : undefined;
  const base = leftoverDirtyPreview ? pinDocumentTab(tabs, leftoverDirtyPreview.id) : tabs;
  return [...base, nextTab];
}
