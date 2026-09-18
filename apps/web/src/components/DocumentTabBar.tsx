"use client";

import { X } from "lucide-react";
import { tabTitle } from "@/lib/documentTabs";
import { useEditorUi } from "@/lib/editorUi";
import { useApp } from "@/lib/store";

export function DocumentTabBar({ compact = false }: { compact?: boolean }) {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const activeDirty = useApp((s) => s.dirty);
  const switchTab = useApp((s) => s.switchTab);
  const closeTab = useApp((s) => s.closeTab);
  const { confirmIfDirty } = useEditorUi();

  const requestClose = (tabId: string) => {
    const state = useApp.getState();
    const tab = state.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;
    const dirty = tabId === state.activeTabId ? state.dirty : tab.dirty;
    if (dirty) {
      confirmIfDirty(() => closeTab(tabId));
      return;
    }
    closeTab(tabId);
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto ${compact ? "py-0.5" : ""}`}
      data-testid="document-tab-bar"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const dirty = tab.id === activeTabId ? activeDirty : tab.dirty;
        const title = tabTitle(tab);
        return (
          <div
            key={tab.id}
            className={`group flex max-w-[220px] shrink-0 items-stretch rounded-md border ${
              active
                ? "border-[#c7d7fe] bg-[#eef4ff] shadow-sm"
                : "border-transparent bg-[#f2f4f7] hover:bg-[#e8eefc]"
            }`}
            data-testid="document-tab"
            data-active={active ? "true" : "false"}
          >
            <button
              type="button"
              title={title}
              className={`min-w-0 flex-1 truncate px-2.5 text-left ${compact ? "py-1 text-[12px]" : "py-1.5 text-[13px]"} ${
                active ? "font-medium text-[#1c1f24]" : "text-[#344054]"
              }`}
              onClick={() => switchTab(tab.id)}
            >
              {title}
              {dirty ? <span className="ml-1 text-accent">•</span> : null}
            </button>
            <button
              type="button"
              title="Close"
              aria-label={`Close ${title}`}
              data-testid="document-tab-close"
              className={`inline-flex shrink-0 items-center justify-center rounded-r-md text-[#667085] hover:bg-[#dbeafe] hover:text-[#1c1f24] ${
                compact ? "w-7" : "w-8"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                requestClose(tab.id);
              }}
            >
              <X size={compact ? 14 : 15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
