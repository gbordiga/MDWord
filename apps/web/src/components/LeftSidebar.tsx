"use client";

import { useMemo, useState } from "react";
import { searchIndex, backlinksTo } from "@mdword/indexer";
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

export function LeftSidebar() {
  const left = useApp((s) => s.left);
  const workspace = useApp((s) => s.workspace);
  const model = useApp((s) => s.model);
  const path = useApp((s) => s.path);
  const [q, setQ] = useState("");
  const headings = useMemo(() => headingsOf(model.ast), [model.ast]);
  const results = workspace ? searchIndex(workspace.index, q) : [];
  const backs = workspace && path ? backlinksTo(workspace.index, path) : [];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[#e4e7ec] bg-white">
      <div className="flex border-b border-[#e4e7ec] text-[12px]">
        {(["files", "outline", "search", "backlinks"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => useApp.getState().setLeft(id)}
            className={`flex-1 px-1 py-2 capitalize ${left === id ? "font-medium text-accent" : "text-[#667085]"}`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-2 text-[13px]">
        {left === "files" && (
          <ul className="space-y-1">
            {(workspace?.files.filter((f) => f.name.endsWith(".md")) ?? []).map((f) => (
              <li key={f.path} className="truncate rounded px-2 py-1 hover:bg-[#f2f4f7]">
                {f.name}
              </li>
            ))}
            {!workspace && <p className="p-2 text-[#667085]">Open a folder to browse files.</p>}
          </ul>
        )}
        {left === "outline" && (
          <ul className="space-y-1">
            {headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.depth - 1) * 12 }} className="truncate">
                {h.text || "Untitled"}
              </li>
            ))}
          </ul>
        )}
        {left === "search" && (
          <div>
            <input
              className="mb-2 w-full rounded-md border border-[#e4e7ec] px-2 py-1"
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
