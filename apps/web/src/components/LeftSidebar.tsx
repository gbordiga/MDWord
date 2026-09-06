"use client";

import { useMemo, useState } from "react";
import { searchIndex, backlinksTo } from "@mdword/indexer";
import { cn } from "@mdword/ui";
import { useApp } from "@/lib/store";
import type { GenericNode } from "@mdword/shared";

function headingsOf(ast: GenericNode): { text: string; depth: number }[] {
  const out: { text: string; depth: number }[] = [];
  const walk = (n: GenericNode) => {
    if (n.type === "heading") {
      const text = (n.children ?? [])
        .map((c) => (typeof c.value === "string" ? c.value : ""))
        .join("");
      out.push({ text, depth: Number(n.depth ?? 1) });
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
  const [q, setQ] = useState("");
  const headings = useMemo(() => headingsOf(model.ast), [model.ast]);
  const results = workspace ? searchIndex(workspace.index, q) : [];
  const backs = workspace && path ? backlinksTo(workspace.index, path) : [];

  return (
    <aside className={cn("flex h-full w-64 shrink-0 flex-col border-r border-[#e4e7ec] bg-white", className)}>
      <div className="flex border-b border-[#e4e7ec] text-[12px]">
        {(["files", "outline", "search", "backlinks"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => useApp.getState().setLeft(id)}
            className={`min-h-11 flex-1 px-1 py-2 capitalize touch-manipulation ${left === id ? "font-medium text-accent" : "text-[#667085]"}`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-2 text-[13px]">
        {left === "files" && (
          <ul className="space-y-1" data-testid="workspace-files">
            {(workspace?.files.filter((f) => f.name.endsWith(".md")) ?? []).map((f) => {
              const active = path === f.path || path === f.name || (path ?? "").endsWith(`/${f.name}`);
              return (
                <li key={f.path}>
                  <button
                    type="button"
                    data-testid="workspace-file"
                    data-path={f.path}
                    onClick={() => void useApp.getState().openWorkspaceFile(f.path)}
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
        )}
        {left === "outline" && (
          <ul className="space-y-1">
            {headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.depth - 1) * 12 }} className="truncate py-2">
                {h.text || "Untitled"}
              </li>
            ))}
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
                <li key={d.path} className="truncate px-1 py-1">
                  {d.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        {left === "backlinks" && (
          <ul>
            {backs.map((d) => (
              <li key={d.path}>{d.title}</li>
            ))}
            {!workspace && <p className="p-2 text-[#667085]">Open a folder to see backlinks.</p>}
          </ul>
        )}
      </div>
    </aside>
  );
}
