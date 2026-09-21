"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { tabTitle } from "@/lib/documentTabs";
import { nextTabStripScrollLeft, scrollLeftToRevealTab, tabOverflowFlags } from "@/lib/documentTabOverflow";
import { useEditorUi } from "@/lib/editorUi";
import { useApp } from "@/lib/store";

function OverflowCaret({
  direction,
  compact,
  onClick
}: {
  direction: "left" | "right";
  compact: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      data-testid={`document-tab-scroll-${direction}`}
      title={direction === "left" ? "Show previous tabs" : "Show next tabs"}
      aria-label={direction === "left" ? "Show previous tabs" : "Show next tabs"}
      className={`inline-flex shrink-0 items-center justify-center self-stretch rounded-md text-[#667085] hover:bg-[#e8eefc] hover:text-[#1c1f24] ${
        compact ? "w-7" : "w-8"
      }`}
      onClick={onClick}
    >
      <Icon size={compact ? 14 : 16} />
    </button>
  );
}

export function DocumentTabBar({ compact = false }: { compact?: boolean }) {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const activeDirty = useApp((s) => s.dirty);
  const switchTab = useApp((s) => s.switchTab);
  const pinTab = useApp((s) => s.pinTab);
  const closeTab = useApp((s) => s.closeTab);
  const { confirmIfDirty } = useEditorUi();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());
  const [overflow, setOverflow] = useState({ canScrollLeft: false, canScrollRight: false });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflow(tabOverflowFlags(el.scrollLeft, el.scrollWidth, el.clientWidth));
  }, []);

  const revealActive = useCallback(() => {
    const el = scrollerRef.current;
    const tab = tabRefs.current.get(activeTabId);
    if (!el || !tab) return;
    const next = scrollLeftToRevealTab(tab.offsetLeft, tab.offsetWidth, el.scrollLeft, el.clientWidth);
    if (next != null) el.scrollLeft = next;
    measure();
  }, [activeTabId, measure]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      left: nextTabStripScrollLeft(el.scrollLeft, el.clientWidth, el.scrollWidth, direction),
      behavior: "smooth"
    });
  };

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(() => {
      revealActive();
      measure();
    });
    const ro = new ResizeObserver(() => {
      revealActive();
      measure();
    });
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [activeTabId, measure, revealActive, tabs]);

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
      className={`flex min-w-0 flex-1 items-stretch gap-0.5 ${compact ? "py-0.5" : ""}`}
      data-testid="document-tab-bar"
    >
      {overflow.canScrollLeft ? (
        <OverflowCaret direction="left" compact={compact} onClick={() => scrollByPage(-1)} />
      ) : null}
      <div
        ref={scrollerRef}
        data-testid="document-tab-scroller"
        className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => {
          const el = scrollerRef.current;
          if (!el || el.scrollWidth <= el.clientWidth) return;
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          el.scrollLeft += event.deltaY;
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const dirty = tab.id === activeTabId ? activeDirty : tab.dirty;
          const title = tabTitle(tab);
          return (
            <div
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              className={`group flex max-w-[220px] shrink-0 items-stretch rounded-md border ${
                active
                  ? "border-[#c7d7fe] bg-[#eef4ff] shadow-sm"
                  : "border-transparent bg-[#f2f4f7] hover:bg-[#e8eefc]"
              }`}
              data-testid="document-tab"
              data-active={active ? "true" : "false"}
              data-preview={tab.preview ? "true" : "false"}
            >
              <button
                type="button"
                title={tab.preview ? `${title} (Preview)` : title}
                data-testid="document-tab-title"
                className={`min-w-0 flex-1 truncate px-2.5 text-left ${compact ? "py-1 text-[12px]" : "py-1.5 text-[13px]"} ${
                  active ? "font-medium text-[#1c1f24]" : "text-[#344054]"
                } ${tab.preview ? "italic" : ""}`}
                onClick={() => switchTab(tab.id)}
                onDoubleClick={() => pinTab(tab.id)}
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
      {overflow.canScrollRight ? (
        <OverflowCaret direction="right" compact={compact} onClick={() => scrollByPage(1)} />
      ) : null}
    </div>
  );
}
