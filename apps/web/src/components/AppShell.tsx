"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Ribbon } from "./Ribbon";
import { LeftSidebar } from "./LeftSidebar";
import { PropertiesPanel } from "./PropertiesPanel";
import { VisualEditor } from "./VisualEditor";
import { SourcePane } from "./SourcePane";
import { CommandPalette } from "./CommandPalette";
import { MobileFormatBar, MobileSheets, MobileTabBar, MobileTopBar } from "./MobileChrome";
import { FindBar } from "./FindBar";
import { EditorContextBar } from "./EditorContextBar";
import { LinkBubble } from "./LinkBubble";
import { LinkDialog } from "./LinkDialog";
import { ImageDialog } from "./ImageDialog";
import { WikilinkDialog } from "./WikilinkDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { BusyOverlay } from "./BusyOverlay";
import { Spinner } from "./Spinner";
import { useApp } from "@/lib/store";
import { getHost } from "@/lib/host";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useCtrlWheelZoom } from "@/hooks/useCtrlWheelZoom";
import { insertTable } from "@/lib/editorCommands";
import { EditorUiProvider, useEditorUi } from "@/lib/editorUi";

export function AppShell() {
  const editorRef = useRef<Editor | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <EditorUiProvider editor={editor}>
      <AppShellInner editorRef={editorRef} editor={editor} setEditor={setEditor} />
    </EditorUiProvider>
  );
}

function AppShellInner({
  editorRef,
  editor,
  setEditor
}: {
  editorRef: { current: Editor | null };
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
}) {
  const view = useApp((s) => s.view);
  const leftOpen = useApp((s) => s.leftOpen);
  const rightOpen = useApp((s) => s.rightOpen);
  const dirty = useApp((s) => s.dirty);
  const path = useApp((s) => s.path);
  const diagnostics = useApp((s) => s.model.diagnostics);
  const busy = useApp((s) => s.busy);
  const { keyboardOpen } = useVisualViewport();
  const { openLink, openImage, openWikilink, dialog, closeDialog, confirm, confirmIfDirty, closeConfirm } =
    useEditorUi();
  useCtrlWheelZoom();

  useEffect(() => {
    const collapseChrome = () => {
      if (window.innerWidth >= 1024) {
        if (useApp.getState().mobileSheet) useApp.setState({ mobileSheet: null });
        return;
      }
      const state = useApp.getState();
      if (state.leftOpen || state.rightOpen) {
        useApp.setState({ leftOpen: false, rightOpen: false });
      }
    };
    collapseChrome();
    window.addEventListener("resize", collapseChrome);
    return () => window.removeEventListener("resize", collapseChrome);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        useApp.getState().setPalette(true);
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void useApp.getState().saveFile();
      }
      if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        useApp.getState().setFind(true);
      }
      if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        confirmIfDirty(() => useApp.getState().newDocument());
      }
      if (meta && e.key.toLowerCase() === "o") {
        e.preventDefault();
        confirmIfDirty(() => void useApp.getState().openFile());
      }
      if (meta && e.key.toLowerCase() === "b") {
        editorRef.current?.chain().focus().toggleBold().run();
      }
      if (meta && e.key.toLowerCase() === "i") {
        editorRef.current?.chain().focus().toggleItalic().run();
      }
      if (meta && e.key.toLowerCase() === "u") {
        e.preventDefault();
        editorRef.current?.chain().focus().toggleUnderline().run();
      }
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openLink();
      }
      if (meta && e.key === "1") editorRef.current?.chain().focus().toggleHeading({ level: 1 }).run();
      if (meta && e.key === "2") editorRef.current?.chain().focus().toggleHeading({ level: 2 }).run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmIfDirty, openLink]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const state = useApp.getState();
      if (!state.dirty) return;
      void getHost().app.writeRecovery("current", state.model.source, {
        path: state.path,
        updatedMs: Date.now()
      });
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("mdword-ready");
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timeout = window.setTimeout(() => useApp.getState().finishBusy(), 30000);
    return () => window.clearTimeout(timeout);
  }, [busy]);

  const insert = (kind: string) => {
    const ed = editorRef.current;
    if (kind === "table" && ed) insertTable(ed);
    if (kind === "figure") openImage();
    if (kind === "wikilink") openWikilink();
    if (kind === "link") openLink();
  };

  return (
    <div
      className="mdword-app relative flex h-dvh min-h-0 w-full flex-col overflow-hidden"
      data-mdword-root
      aria-busy={Boolean(busy)}
    >
      <MobileTopBar />
      <Ribbon editor={editor} />
      <MobileFormatBar editor={editor} />
      <FindBar />
      <EditorContextBar />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {leftOpen && <LeftSidebar className="max-lg:hidden" />}
        <div
          className={`flex min-h-0 min-w-0 flex-1 ${
            view === "split" ? "flex-col lg:flex-row" : ""
          }`}
        >
          {view !== "source" && <VisualEditor editorRef={editorRef} onEditor={setEditor} />}
          {view !== "document" && (
            <div
              className={
                view === "split"
                  ? "min-h-0 min-w-0 flex-1 border-t border-[#e4e7ec] lg:w-1/2 lg:border-l lg:border-t-0"
                  : "min-h-0 min-w-0 flex-1"
              }
            >
              <SourcePane />
            </div>
          )}
        </div>
        {rightOpen && <PropertiesPanel className="max-lg:hidden" />}
        {busy?.blocking ? <BusyOverlay label={busy.label} /> : null}
      </div>
      <footer className="hidden h-7 shrink-0 items-center justify-between border-t border-[#e4e7ec] bg-white px-3 text-[11px] text-[#667085] lg:flex">
        <span>
          {path ?? "Untitled"} {dirty ? "•" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {busy ? (
            <>
              <Spinner size={12} />
              <span data-testid="app-busy-label">{busy.label}</span>
            </>
          ) : (
            <>
              {view} · {diagnostics.length ? `${diagnostics.length} diagnostics` : "Ready"}
            </>
          )}
        </span>
      </footer>
      <MobileTabBar keyboardOpen={keyboardOpen} />
      <MobileSheets editor={editor} />
      <CommandPalette onInsert={insert} />
      <LinkBubble />
      <LinkDialog open={dialog === "link"} editor={editor} onClose={closeDialog} />
      <ImageDialog open={dialog === "image"} editor={editor} onClose={closeDialog} />
      <WikilinkDialog open={dialog === "wikilink"} editor={editor} onClose={closeDialog} />
      <ConfirmDialog confirm={confirm} onClose={closeConfirm} />
    </div>
  );
}
