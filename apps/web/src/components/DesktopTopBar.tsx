"use client";

import { displayDocumentTitle } from "@mdword/shared";
import { useApp } from "@/lib/store";

export function DesktopTopBar() {
  const dirty = useApp((s) => s.dirty);
  const path = useApp((s) => s.path);
  const title = useApp((s) => displayDocumentTitle(s.model.frontmatter, s.path));
  const busy = useApp((s) => s.busy);
  const lastDraftAt = useApp((s) => s.lastDraftAt);
  const lastSavedAt = useApp((s) => s.lastSavedAt);
  const saveHint =
    busy?.kind === "save"
      ? "Saving…"
      : dirty && !path && lastDraftAt
        ? "Draft saved locally"
        : dirty
          ? "Unsaved"
          : lastSavedAt
            ? "Saved"
            : "Ready";

  return (
    <header
      data-testid="desktop-top-bar"
      className="md-titlebar hidden w-full shrink-0 items-center gap-3 border-b border-[#e4e7ec] bg-white lg:flex"
    >
      <span className="shrink-0 text-[13px] font-semibold tracking-tight text-[#1c1f24]">MDWord</span>
      <span className="h-4 w-px shrink-0 bg-[#e4e7ec]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-[#1c1f24]">
          {title}
          {dirty ? <span className="ml-1 text-accent">•</span> : null}
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-[#667085]" data-testid="desktop-top-save-status">
        {saveHint}
      </span>
    </header>
  );
}
