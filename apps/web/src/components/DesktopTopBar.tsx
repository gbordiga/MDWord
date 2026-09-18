"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { useApp } from "@/lib/store";
import { saveStatusText } from "@/lib/saveStatus";
import { DocumentTabBar } from "./DocumentTabBar";

export function DesktopTopBar() {
  const dirty = useApp((s) => s.dirty);
  const busy = useApp((s) => s.busy);
  const lastSavedAt = useApp((s) => s.lastSavedAt);
  const leftOpen = useApp((s) => s.leftOpen);
  const rightOpen = useApp((s) => s.rightOpen);
  const saveHint = saveStatusText({ busyKind: busy?.kind, dirty, lastSavedAt });

  return (
    <header
      data-testid="desktop-top-bar"
      className="md-titlebar hidden w-full shrink-0 border-b border-[#e4e7ec] bg-white lg:flex"
    >
      <div className="md-titlebar-drag">
        <span className="shrink-0 text-[13px] font-semibold tracking-tight text-[#1c1f24]">MDWord</span>
        <span className="h-4 w-px shrink-0 bg-[#e4e7ec]" aria-hidden />
        <DocumentTabBar />
        {saveHint.text ? (
          <span className="shrink-0 text-[11px] text-[#667085]" data-testid="desktop-top-save-status">
            {saveHint.text}
          </span>
        ) : null}
        <button
          type="button"
          data-testid="topbar-sidebar"
          title="Toggle sidebar"
          aria-pressed={leftOpen}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${
            leftOpen ? "bg-[#e8eefc] text-accent" : "text-[#344054] hover:bg-[#f2f4f7]"
          }`}
          onClick={() => useApp.getState().toggleLeft()}
        >
          <PanelLeft size={14} />
          Sidebar
        </button>
        <button
          type="button"
          data-testid="topbar-properties"
          title="Toggle properties"
          aria-pressed={rightOpen}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${
            rightOpen ? "bg-[#e8eefc] text-accent" : "text-[#344054] hover:bg-[#f2f4f7]"
          }`}
          onClick={() => useApp.getState().toggleRight()}
        >
          <PanelRight size={14} />
          Properties
        </button>
      </div>
      <div className="md-titlebar-caption" aria-hidden />
    </header>
  );
}
