import { tabTitle, type DocumentTab } from "./documentTabs";

export function sessionIsDirty(state: {
  tabs: { id: string; dirty: boolean }[];
  activeTabId: string;
  dirty: boolean;
}): boolean {
  return state.tabs.some((tab) => (tab.id === state.activeTabId ? state.dirty : tab.dirty));
}

export function dirtyDocumentTitles(
  tabs: DocumentTab[],
  activeTabId: string,
  activeDirty: boolean
): string[] {
  return tabs
    .filter((tab) => (tab.id === activeTabId ? activeDirty : tab.dirty))
    .map((tab) => tabTitle(tab));
}

export function unsavedCloseMessage(titles: string[]): string {
  if (titles.length <= 1) {
    const title = titles[0] ?? "This document";
    return `${title} has unsaved changes. Save them before closing, or discard them. The window stays open until you do.`;
  }
  const listed = titles.join(", ");
  return `${titles.length} documents have unsaved changes (${listed}). Save them before closing, or discard them. The window stays open until you do.`;
}
