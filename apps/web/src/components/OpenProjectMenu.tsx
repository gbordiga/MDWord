"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock, Folder } from "lucide-react";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";

function projectName(projectPath: string): string {
  const last = projectPath.split("/").pop() ?? projectPath;
  return last.split("\\").pop() || projectPath;
}

export function OpenProjectMenu({
  disabled,
  busy,
  compact = false
}: {
  disabled: boolean;
  busy: boolean;
  compact?: boolean;
}) {
  const recentProjects = useApp((s) => s.recentProjects);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Open project"
        aria-label="Open project"
        aria-expanded={open}
        data-testid={compact ? "topbar-open-folder" : undefined}
        disabled={disabled || busy}
        className={
          compact
            ? "inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7] disabled:cursor-not-allowed disabled:opacity-40"
            : "inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-[#1c1f24] hover:bg-[#eef2f6] disabled:cursor-not-allowed disabled:opacity-50"
        }
        onClick={() => {
          const box = rootRef.current?.getBoundingClientRect();
          if (box) setMenuBox({ top: box.bottom + 4, left: box.left });
          setOpen((value) => !value);
        }}
      >
        {busy ? <Spinner size={14} /> : <Folder size={compact ? 14 : 16} />}
        {compact ? null : "Open project"}
        <ChevronDown size={compact ? 12 : 14} />
      </button>
      {open
        ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-testid="open-project-menu"
          style={{ top: menuBox.top, left: menuBox.left }}
          className="fixed z-50 min-w-56 rounded-md border border-[#e4e7ec] bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="open-new-project"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#1c1f24] hover:bg-[#f2f4f7]"
            onClick={() => {
              setOpen(false);
              void useApp.getState().openFolder();
            }}
          >
            <Folder size={14} /> Open new project
          </button>
          {recentProjects.length ? <div className="mx-2 my-1 h-px bg-[#e4e7ec]" /> : null}
          {recentProjects.slice(0, 8).map((projectPath) => (
            <button
              key={projectPath}
              type="button"
              role="menuitem"
              data-testid="recent-project"
              title={projectPath}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#1c1f24] hover:bg-[#f2f4f7]"
              onClick={() => {
                setOpen(false);
                void useApp.getState().openRecentProject(projectPath);
              }}
            >
              <Clock size={14} className="shrink-0 text-[#667085]" />
              <span className="min-w-0 truncate">{projectName(projectPath)}</span>
            </button>
          ))}
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
