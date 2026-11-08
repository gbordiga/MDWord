"use client";

import { FilePlus, FolderOpen, PanelLeft, Redo2, Save, Search, SlidersHorizontal, Sparkles, Undo2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { assistantSupported } from "@/lib/assistant/store";
import { useEditorUi } from "@/lib/editorUi";
import { DocumentTabBar } from "./DocumentTabBar";
import { OpenProjectMenu } from "./OpenProjectMenu";
import { Spinner } from "./Spinner";

function QuickBtn({
  title,
  testId,
  pressed,
  disabled,
  busy,
  onClick,
  children
}: {
  title: string;
  testId: string;
  pressed?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      data-testid={testId}
      disabled={disabled || busy}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7] disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? "bg-[#e8eefc] text-accent" : ""
      }`}
      onClick={onClick}
    >
      {busy ? <Spinner size={14} /> : children}
    </button>
  );
}

export function DesktopTopBar() {
  const leftOpen = useApp((s) => s.leftOpen);
  const rightOpen = useApp((s) => s.rightOpen);
  const left = useApp((s) => s.left);
  const canUndo = useApp((s) => s.documentUndo.past.length > 0);
  const canRedo = useApp((s) => s.documentUndo.future.length > 0);
  const busy = useApp((s) => s.busy);
  const fileBusy = Boolean(busy?.blocking);
  const saving = busy?.kind === "save";
  const openingFolder = busy?.kind === "folder";
  const { confirmIfDirty } = useEditorUi();

  return (
    <header
      data-testid="desktop-top-bar"
      className="md-titlebar hidden w-full shrink-0 border-b border-[#e4e7ec] bg-white lg:flex"
    >
      <div className="md-titlebar-drag">
        <span className="shrink-0 text-[13px] font-semibold tracking-tight text-[#1c1f24]">MDWord</span>
        <span className="h-4 w-px shrink-0 bg-[#e4e7ec]" aria-hidden />
        <div className="flex shrink-0 items-center gap-0.5" data-testid="topbar-quick">
          <QuickBtn title="New" testId="topbar-new" disabled={fileBusy} onClick={() => confirmIfDirty(() => useApp.getState().newDocument())}>
            <FilePlus size={14} />
          </QuickBtn>
          <QuickBtn title="Open" testId="topbar-open" disabled={fileBusy} onClick={() => void useApp.getState().openFile()}>
            <FolderOpen size={14} />
          </QuickBtn>
          <OpenProjectMenu compact disabled={fileBusy && !openingFolder} busy={openingFolder} />
          <QuickBtn
            title="Save"
            testId="topbar-save"
            busy={saving}
            disabled={fileBusy && !saving}
            onClick={() => void useApp.getState().saveFile()}
          >
            <Save size={14} />
          </QuickBtn>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-[#e4e7ec]" aria-hidden />
          <QuickBtn title="Undo" testId="topbar-undo" disabled={!canUndo} onClick={() => useApp.getState().undoDocument()}>
            <Undo2 size={14} />
          </QuickBtn>
          <QuickBtn title="Redo" testId="topbar-redo" disabled={!canRedo} onClick={() => useApp.getState().redoDocument()}>
            <Redo2 size={14} />
          </QuickBtn>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-[#e4e7ec]" aria-hidden />
          <QuickBtn title="Find" testId="topbar-find" onClick={() => useApp.getState().setFind(true)}>
            <Search size={14} />
          </QuickBtn>
        </div>
        <DocumentTabBar />
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
          aria-pressed={leftOpen && left === "properties"}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${
            leftOpen && left === "properties" ? "bg-[#e8eefc] text-accent" : "text-[#344054] hover:bg-[#f2f4f7]"
          }`}
          onClick={() => useApp.getState().toggleProperties()}
        >
          <SlidersHorizontal size={14} />
          Properties
        </button>
        {assistantSupported() ? (
          <button
            type="button"
            data-testid="topbar-assistant"
            title="Toggle assistant"
            aria-pressed={rightOpen}
            className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${
              rightOpen ? "bg-[#e8eefc] text-accent" : "text-[#344054] hover:bg-[#f2f4f7]"
            }`}
            onClick={() => useApp.getState().showRightPanel("assistant")}
          >
            <Sparkles size={14} />
            Assistant
          </button>
        ) : null}
      </div>
      <div className="md-titlebar-caption" aria-hidden />
    </header>
  );
}
