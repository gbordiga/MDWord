"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Ribbon } from "./Ribbon";
import { LeftSidebar } from "./LeftSidebar";
import { PropertiesPanel } from "./PropertiesPanel";
import { VisualEditor } from "./VisualEditor";
import { SourcePane } from "./SourcePane";
import { CommandPalette } from "./CommandPalette";
import { useApp } from "@/lib/store";
import { getHost } from "@/lib/host";

export function AppShell() {
  const editorRef = useRef<Editor | null>(null);
  const view = useApp((s) => s.view);
  const leftOpen = useApp((s) => s.leftOpen);
  const rightOpen = useApp((s) => s.rightOpen);
  const dirty = useApp((s) => s.dirty);
  const path = useApp((s) => s.path);
  const diagnostics = useApp((s) => s.model.diagnostics);
  const actions = useApp();

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
      if (meta && e.key.toLowerCase() === "b") {
        editorRef.current?.chain().focus().toggleBold().run();
      }
      if (meta && e.key.toLowerCase() === "i") {
        editorRef.current?.chain().focus().toggleItalic().run();
      }
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const href = window.prompt("URL");
        if (href) editorRef.current?.chain().focus().setLink({ href }).run();
      }
      if (meta && e.key === "1") editorRef.current?.chain().focus().toggleHeading({ level: 1 }).run();
      if (meta && e.key === "2") editorRef.current?.chain().focus().toggleHeading({ level: 2 }).run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const insert = (kind: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    if (kind === "table") ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    if (kind === "figure") {
      const src = window.prompt("Image path");
      if (src) ed.chain().focus().setImage({ src }).run();
    }
    if (kind === "wikilink") {
      const target = window.prompt("Wikilink");
      if (target) ed.chain().focus().insertContent({ type: "wikiLink", attrs: { target, label: target } }).run();
    }
  };

  return (
    <div className="flex h-screen flex-col" data-mdword-root>
      <Ribbon editor={editorRef.current} />
      <div className="flex min-h-0 flex-1">
        {leftOpen && <LeftSidebar />}
        <div className="flex min-w-0 flex-1">
          {view !== "source" && <VisualEditor editorRef={editorRef} />}
          {view !== "document" && (
            <div className={view === "split" ? "w-1/2 border-l border-[#e4e7ec]" : "flex-1"}>
              <SourcePane />
            </div>
          )}
        </div>
        {rightOpen && <PropertiesPanel />}
      </div>
      <footer className="flex h-7 items-center justify-between border-t border-[#e4e7ec] bg-white px-3 text-[11px] text-[#667085]">
        <span>
          {path ?? "Untitled"} {dirty ? "•" : ""}
        </span>
        <span>
          {view} · {diagnostics.length ? `${diagnostics.length} diagnostics` : "Ready"}
        </span>
      </footer>
      <CommandPalette onInsert={insert} />
    </div>
  );
}
