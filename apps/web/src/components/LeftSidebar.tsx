"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { searchIndex, backlinksTo } from "@mdword/indexer";
import { cn } from "@mdword/ui";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";
import type { GenericNode } from "@mdword/shared";
import { focusHeading } from "@/lib/editorCommands";
import { useEditorUi } from "@/lib/editorUi";
import { HistoryPane } from "./HistoryPane";

function headingsOf(ast: GenericNode): { text: string; depth: number }[] {
  const out: { text: string; depth: number }[] = [];
  const textOf = (n: GenericNode): string => {
    if (typeof n.value === "string") return n.value;
    return (n.children ?? []).map(textOf).join("");
  };
  const walk = (n: GenericNode) => {
    if (n.type === "heading") {
      out.push({ text: textOf(n).trim(), depth: Number(n.depth ?? 1) });
    }
    n.children?.forEach(walk);
  };
  walk(ast);
  return out;
}

export function LeftSidebar({ className }: { className?: string }) {
  const left = useApp((s) => s.left);
  const workspace = useApp((s) => s.workspace);
  const model = useApp((s) => s.model);
  const path = useApp((s) => s.path);
  const busy = useApp((s) => s.busy);
  const { editor, confirmIfDirty } = useEditorUi();
  const [q, setQ] = useState("");
  const headings = useMemo(() => headingsOf(model.ast), [model.ast]);
  const results = workspace ? searchIndex(workspace.index, q) : [];
  const backs = workspace && path ? backlinksTo(workspace.index, path) : [];

  const openFile = (filePath: string) => {
    confirmIfDirty(() => void useApp.getState().openWorkspaceFile(filePath));
  };

  return (
    <aside className={cn("flex h-full w-full min-w-0 flex-col border-r border-[#e4e7ec] bg-white", className)}>
      <div className="flex border-b border-[#e4e7ec] text-[12px]">
        {(["files", "outline", "search", "history", "backlinks"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => useApp.getState().setLeft(id)}
            className={`min-h-11 flex-1 px-1 py-2 capitalize touch-manipulation ${left === id ? "font-medium text-accent" : "text-[#667085]"}`}
          >
            {id}
          </button>
        ))}
        <button
          type="button"
          aria-label="Close sidebar"
          title="Close sidebar"
          data-testid="close-left-sidebar"
          className="shrink-0 px-2 text-[#667085] hover:bg-[#f2f4f7] hover:text-[#1c1f24]"
          onClick={() => useApp.getState().toggleLeft()}
        >
          <X size={16} />
        </button>
      </div>
      <div className="relative flex-1 overflow-auto p-2 text-[13px]">
        {busy?.kind === "folder" ? (
          <div
            className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-[#667085]"
            data-testid="workspace-loading"
            role="status"
          >
            <Spinner size={22} />
            <p>{busy.label}</p>
          </div>
        ) : left === "files" ? (
          <ul className="space-y-1" data-testid="workspace-files">
            {(workspace?.files.filter((f) => f.name.endsWith(".md")) ?? []).map((f) => {
              const active = path === f.path || path === f.name || (path ?? "").endsWith(`/${f.name}`);
              return (
                <li key={f.path}>
                  <button
                    type="button"
                    data-testid="workspace-file"
                    data-path={f.path}
                    onClick={() => openFile(f.path)}
                    className={`w-full truncate rounded px-2 py-2.5 text-left hover:bg-[#f2f4f7] ${
                      active ? "bg-[#e8eefc] font-medium text-accent" : ""
                    }`}
                  >
                    {f.name}
                  </button>
                </li>
              );
            })}
            {workspace && workspace.files.filter((f) => f.name.endsWith(".md")).length === 0 && (
              <p className="p-2 text-[#667085]">No markdown files yet. Save a document to see it here.</p>
            )}
            {!workspace && <p className="p-2 text-[#667085]">Open a folder to browse files.</p>}
          </ul>
        ) : null}
        {left === "outline" && (
          <ul className="space-y-1" data-testid="outline-list">
            {headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.depth - 1) * 12 }}>
                <button
                  type="button"
                  data-testid="outline-item"
                  className="w-full truncate rounded px-2 py-2 text-left hover:bg-[#f2f4f7]"
                  onClick={() => editor && focusHeading(editor, i)}
                >
                  {h.text || "Untitled"}
                </button>
              </li>
            ))}
            {headings.length === 0 && (
              <p className="p-2 text-[#667085]">Headings in this document will appear here.</p>
            )}
          </ul>
        )}
        {left === "search" && (
          <div>
            <input
              className="mb-2 w-full rounded-md border border-[#e4e7ec] px-2 py-2 text-[16px] lg:py-1 lg:text-[13px]"
              placeholder="Search workspace"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul>
              {results.map((d) => (
                <li key={d.path}>
                  <button
                    type="button"
                    data-testid="search-result"
                    className="w-full truncate rounded px-2 py-2 text-left hover:bg-[#f2f4f7]"
                    onClick={() => openFile(d.path)}
                  >
                    {d.title}
                  </button>
                </li>
              ))}
            </ul>
            {workspace && q && results.length === 0 && (
              <p className="p-2 text-[#667085]">No matching documents.</p>
            )}
            {!workspace && <p className="p-2 text-[#667085]">Open a folder to search across files.</p>}
          </div>
        )}
        {left === "history" && <HistoryPane />}
        {left === "backlinks" && (
          <ul>
            {backs.map((d) => (
              <li key={d.path}>
                <button
                  type="button"
                  data-testid="backlink-result"
                  className="w-full truncate rounded px-2 py-2 text-left hover:bg-[#f2f4f7]"
                  onClick={() => openFile(d.path)}
                >
                  {d.title}
                </button>
              </li>
            ))}
            {workspace && path && backs.length === 0 && (
              <p className="p-2 text-[#667085]">No other documents link here yet.</p>
            )}
            {!workspace && <p className="p-2 text-[#667085]">Open a folder to see backlinks.</p>}
          </ul>
        )}
      </div>
    </aside>
  );
}
