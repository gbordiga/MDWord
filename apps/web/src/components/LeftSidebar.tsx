"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { searchHits, type SearchHitField } from "@mdword/indexer";
import { cn } from "@mdword/ui";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";
import type { GenericNode } from "@mdword/shared";
import { focusHeading } from "@/lib/editorCommands";
import { useEditorUi } from "@/lib/editorUi";
import { HistoryPane } from "./HistoryPane";
import { FileTree } from "./FileTree";

function relativeWorkspacePath(path: string, root?: string | null): string {
  const norm = path.replace(/\\/g, "/");
  if (!root) return norm;
  const prefix = root.replace(/\\/g, "/").replace(/\/$/, "");
  return norm.startsWith(`${prefix}/`) ? norm.slice(prefix.length + 1) : norm;
}

function searchFieldLabel(field: SearchHitField): string {
  if (field === "title") return "Matched in title";
  if (field === "path") return "Matched in path";
  if (field === "tags") return "Matched in tags";
  return "Matched in text";
}

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
  const { editor } = useEditorUi();
  const [q, setQ] = useState("");
  const headings = useMemo(() => headingsOf(model.ast), [model.ast]);
  const results = workspace ? searchHits(workspace.index, q) : [];

  const openFile = (filePath: string, options?: { preview?: boolean }) => {
    void useApp.getState().openWorkspaceFile(filePath, options);
  };

  return (
    <aside className={cn("flex h-full w-full min-w-0 flex-col border-r border-[#e4e7ec] bg-white", className)}>
      <div className="flex border-b border-[#e4e7ec] text-[12px]">
        {(["files", "outline", "search", "history"] as const).map((id) => (
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
        {busy?.kind === "folder" && !workspace?.files.length ? (
          <div
            className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-[#667085]"
            data-testid="workspace-loading"
            role="status"
          >
            <Spinner size={22} />
            <p>{busy.label}</p>
          </div>
        ) : left === "files" ? (
          workspace?.root ? (
            <FileTree
              files={workspace.files}
              root={workspace.root}
              currentPath={path}
              onOpenFile={openFile}
            />
          ) : (
            <p className="p-2 text-[#667085]">Open a folder to browse files.</p>
          )
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
              data-testid="workspace-search"
              className="mb-2 w-full rounded-md border border-[#e4e7ec] px-2 py-2 text-[16px] lg:py-1 lg:text-[13px]"
              placeholder="Search the open folder (title, path, text, tags)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul>
              {results.map((hit) => (
                <li key={hit.document.path}>
                  <button
                    type="button"
                    data-testid="search-result"
                    className="w-full rounded px-2 py-2 text-left hover:bg-[#f2f4f7]"
                    onClick={() => openFile(hit.document.path, { preview: true })}
                    onDoubleClick={() => openFile(hit.document.path, { preview: false })}
                  >
                    <div className="truncate font-medium text-[#1c1f24]">{hit.document.title}</div>
                    <div data-testid="search-result-path" className="truncate text-[11px] text-[#667085]">
                      {relativeWorkspacePath(hit.document.path, workspace?.root)}
                    </div>
                    {hit.excerpt ? (
                      <div data-testid="search-result-excerpt" className="mt-0.5 line-clamp-2 text-[12px] text-[#344054]">
                        {hit.excerpt}
                      </div>
                    ) : null}
                    <div data-testid="search-result-field" className="mt-0.5 text-[11px] text-[#98a2b3]">
                      {searchFieldLabel(hit.field)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {workspace && !q.trim() && (
              <p data-testid="search-empty-hint" className="p-2 text-[#667085]">
                Type to search the open folder by title, path, text, or tags.
              </p>
            )}
            {workspace && q.trim() && results.length === 0 && (
              <p className="p-2 text-[#667085]">No matching documents.</p>
            )}
            {!workspace && <p className="p-2 text-[#667085]">Open a folder to search across files.</p>}
          </div>
        )}
        {left === "history" && <HistoryPane />}
      </div>
    </aside>
  );
}
