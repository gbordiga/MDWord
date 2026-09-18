import type { DocumentModel } from "@mdword/document-model";
import { displayDocumentTitle } from "@mdword/shared";
import { historyKeyFromPath, newUntitledHistoryKey } from "./documentHistory";
import { untitledDocument } from "./untitled";

export interface DocumentTab {
  id: string;
  path: string | null;
  model: DocumentModel;
  dirty: boolean;
  lastSavedAt: number | null;
  lastSavedContent: string;
  historyKey: string;
  syncGeneration: number;
  sourceGeneration: number;
  editGeneration: number;
}

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
  historyKeySeed: string
): DocumentTab {
  return {
    id: newTabId(),
    path,
    model,
    dirty: false,
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
