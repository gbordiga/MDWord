"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { displayDocumentTitle } from "@mdword/shared";
import { useApp } from "@/lib/store";
import { saveStatusText } from "@/lib/saveStatus";

export function DesktopTopBar() {
  const dirty = useApp((s) => s.dirty);
  const title = useApp((s) => displayDocumentTitle(s.model.frontmatter, s.path));
  const busy = useApp((s) => s.busy);
  const lastSavedAt = useApp((s) => s.lastSavedAt);
  const leftOpen = useApp((s) => s.leftOpen);
  const rightOpen = useApp((s) => s.rightOpen);
  const saveHint = saveStatusText({ busyKind: busy?.kind, dirty, lastSavedAt });

  return (
    <header
      data-testid="desktop-top-bar"
      className="md-titlebar hidden w-full shrink-0 items-center gap-3 border-b border-[#e4e7ec] bg-white px-2 lg:flex"
    >
      <span className="shrink-0 text-[13px] font-semibold tracking-tight text-[#1c1f24]">MDWord</span>
      <span className="h-4 w-px shrink-0 bg-[#e4e7ec]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-[#1c1f24]">
          {title}
          {dirty ? <span className="ml-1 text-accent">•</span> : null}
        </div>
      </div>
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
    </header>
  );
}
