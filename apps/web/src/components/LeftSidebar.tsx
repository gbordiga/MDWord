"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, ListTree, Search, SlidersHorizontal, X } from "lucide-react";
import { searchHits, type SearchHitField } from "@mdword/indexer";
import { cn } from "@mdword/ui";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";
import type { GenericNode } from "@mdword/shared";
import { useEditorDocVersion } from "@/hooks/useEditorDocVersion";
import { useEditorUi } from "@/lib/editorUi";
import { collectEditorOutline, jumpToHeadingPos } from "@/lib/toc";
import { FileTree } from "./FileTree";
import { PropertiesPanel } from "./PropertiesPanel";
import { useIsCompact } from "@/hooks/useMediaQuery";
import type { LeftPanel } from "@/lib/leftPanel";

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

type SidebarHeading = { text: string; depth: number; pos: number | null; number: string };

/** Used before the editor mounts (source view, loading) so the outline stays visible. */
function withNumbers(headings: { text: string; depth: number; pos: number | null }[]): SidebarHeading[] {
  const counters = [0, 0, 0, 0, 0, 0];
  return headings.map((heading) => {
    const depth = Math.min(6, Math.max(1, heading.depth));
    for (let i = depth; i < counters.length; i++) counters[i] = 0;
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    return { ...heading, depth, number: counters.slice(0, depth).join(".") };
  });
}

function headingsOf(ast: GenericNode): SidebarHeading[] {
  const out: { text: string; depth: number; pos: number | null }[] = [];
  const textOf = (n: GenericNode): string => {
    if (typeof n.value === "string") return n.value;
    return (n.children ?? []).map(textOf).join("");
  };
  const walk = (n: GenericNode) => {
    if (n.type === "heading") {
      out.push({ text: textOf(n).trim(), depth: Number(n.depth ?? 1), pos: null });
    }
    n.children?.forEach(walk);
  };
  walk(ast);
  return withNumbers(out);
}

function OutlinePanel({
  headings,
  editor,
  numbered
}: {
  headings: SidebarHeading[];
  editor: ReturnType<typeof useEditorUi>["editor"];
  numbered: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [activePos, setActivePos] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const query = filter.trim().toLowerCase();
  const visible = query ? headings.filter((heading) => (heading.text || "untitled").toLowerCase().includes(query)) : headings;

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const cursor = editor.state.selection.from;
      let current: number | null = null;
      for (const heading of headings) {
        if (heading.pos != null && heading.pos <= cursor) current = heading.pos;
      }
      setActivePos(current);
    };
    sync();
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("selectionUpdate", sync);
    };
  }, [editor, headings]);

  useEffect(() => {
    if (activePos == null || query) return;
    const item = listRef.current?.querySelector<HTMLElement>('[data-current="true"]');
    item?.scrollIntoView({ block: "nearest" });
  }, [activePos, query]);

  if (!headings.length) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-4 text-center">
        <ListTree size={22} className="text-[#98a2b3]" aria-hidden />
        <p className="text-[12px] leading-5 text-[#667085]">
          Headings in this document show up here. Set a paragraph to Heading from the Home tab.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-white pb-1">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter headings"
          placeholder="Filter headings"
          className="min-w-0 flex-1 rounded-md border border-[#e4e7ec] bg-[#f8fafc] px-2 py-1 text-[12px] outline-none focus:border-accent focus:bg-white"
        />
        <span className="shrink-0 text-[11px] text-[#98a2b3]">{headings.length}</span>
      </div>
      {visible.length === 0 ? (
        <p className="px-2 py-3 text-[12px] text-[#667085]">No headings match.</p>
      ) : (
        <ul ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-auto" data-testid="outline-list">
          {visible.map((heading, index) => {
            const current = heading.pos != null && heading.pos === activePos;
            return (
              <li key={`${heading.pos ?? "ast"}-${index}`}>
                <button
                  type="button"
                  data-testid="outline-item"
                  data-current={current ? "true" : "false"}
                  title={heading.text || "Untitled"}
                  style={{ paddingLeft: 8 + (heading.depth - 1) * 12 }}
                  className={`flex w-full items-baseline gap-2 rounded-md py-1.5 pr-2 text-left hover:bg-[#f2f4f7] ${
                    current ? "bg-[#e8eefc] text-accent" : heading.depth <= 1 ? "text-[#1c1f24]" : "text-[#344054]"
                  }`}
                  onClick={() => {
                    if (editor && heading.pos != null) jumpToHeadingPos(editor, heading.pos);
                  }}
                >
                  <span className={`w-7 shrink-0 text-[10px] tabular-nums ${current ? "text-accent" : "text-[#98a2b3]"}`}>
                    {numbered ? heading.number : `H${heading.depth}`}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${heading.depth <= 1 ? "font-medium" : ""}`}>
                    {heading.text || "Untitled"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LeftSidebar({ className }: { className?: string }) {
  const storedLeft = useApp((s) => s.left);
  // Narrow screens show Properties in their own sheet, so it is not a tab there.
  const compact = useIsCompact();
  const left: LeftPanel = compact && storedLeft === "properties" ? "files" : storedLeft;
  const workspace = useApp((s) => s.workspace);
  const model = useApp((s) => s.model);
  const path = useApp((s) => s.path);
  const busy = useApp((s) => s.busy);
  const { editor } = useEditorUi();
  const [q, setQ] = useState("");
  // The editor document is the live source; the AST only feeds the outline
  // while the visual editor is not mounted.
  const docVersion = useEditorDocVersion(editor);
  const headings = useMemo<SidebarHeading[]>(
    () => (editor ? withNumbers(collectEditorOutline(editor)) : headingsOf(model.ast)),
    [editor, docVersion, model.ast]
  );
  const numberedHeadings = Boolean(model.resolvedMdoc.numbering?.headings);
  const results = workspace ? searchHits(workspace.index, q) : [];

  const openFile = (filePath: string, options?: { preview?: boolean }) => {
    void useApp.getState().openWorkspaceFile(filePath, options);
  };

  const allTabs = [
    { id: "properties" as const, label: "Properties", title: "Document properties and page layout", icon: SlidersHorizontal },
    { id: "outline" as const, label: "Outline", title: "Headings in this document", icon: ListTree },
    { id: "files" as const, label: "Files", title: "Files in the open project", icon: FolderOpen },
    { id: "search" as const, label: "Search", title: "Search the open project", icon: Search }
  ];
  const tabs = compact ? allTabs.filter((tab) => tab.id !== "properties") : allTabs;
  const tabId = (id: string) => `sidebar-tab-${id}`;

  // Arrow keys move between tabs, as in a native tab list.
  const onTabKey = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === left);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next]!;
    useApp.getState().setLeft(target.id);
    requestAnimationFrame(() => document.getElementById(tabId(target.id))?.focus());
  };

  return (
    <aside className={cn("flex h-full w-full min-w-0 flex-col border-r border-[#e4e7ec] bg-[#f8fafc]", className)}>
      <div className="flex items-center gap-1 border-b border-[#e4e7ec] bg-[#f8fafc] px-1.5 py-1.5">
        <div
          className="flex min-w-0 flex-1 gap-0.5 rounded-lg bg-[#eef2f6] p-0.5"
          role="tablist"
          aria-label="Sidebar"
          onKeyDown={onTabKey}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = left === tab.id;
            return (
              <button
                key={tab.id}
                id={tabId(tab.id)}
                type="button"
                role="tab"
                data-testid={`sidebar-tab-${tab.id}`}
                title={tab.title}
                aria-label={tab.title}
                aria-selected={active}
                aria-controls="sidebar-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => useApp.getState().setLeft(tab.id)}
                // The open tab shows its name; the others shrink to an icon so four tabs fit a narrow sidebar.
                className={cn(
                  "inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] touch-manipulation transition-[flex-grow,background-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                  active
                    ? "flex-[3_1_0%] bg-white font-medium text-[#1c1f24] shadow-sm"
                    : "flex-1 text-[#667085] hover:bg-white/60 hover:text-[#344054]"
                )}
              >
                <Icon size={14} className={cn("shrink-0", active ? "text-accent" : "text-[#98a2b3]")} aria-hidden />
                {active ? <span className="truncate">{tab.label}</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Close sidebar"
          title="Close sidebar"
          data-testid="close-left-sidebar"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#667085] hover:bg-[#eef2f6] hover:text-[#1c1f24]"
          onClick={() => useApp.getState().toggleLeft()}
        >
          <X size={15} />
        </button>
      </div>
      <div
        id="sidebar-panel"
        role="tabpanel"
        aria-labelledby={tabId(left)}
        className={cn("relative flex-1 overflow-auto bg-white text-[13px]", left === "properties" ? "p-0" : "p-2")}
      >
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
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 px-3 text-center" data-testid="files-empty">
              <FolderOpen size={22} className="text-[#98a2b3]" aria-hidden />
              <p className="text-[12px] leading-5 text-[#667085]">
                Open a project to browse documents, follow wikilinks and keep several files open.
              </p>
              <button
                type="button"
                onClick={() => void useApp.getState().openFolder()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-2.5 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
              >
                <FolderOpen size={14} aria-hidden /> Choose project
              </button>
            </div>
          )
        ) : null}
        {left === "properties" && <PropertiesPanel />}
        {left === "outline" && <OutlinePanel headings={headings} editor={editor} numbered={numberedHeadings} />}
        {left === "search" && (
          <div>
            <input
              data-testid="workspace-search"
              className="mb-2 w-full rounded-md border border-[#e4e7ec] bg-[#f8fafc] px-2.5 py-2 text-[16px] outline-none focus:border-accent focus:bg-white lg:py-1.5 lg:text-[13px]"
              aria-label="Search the open project"
              placeholder="Search this project…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="space-y-0.5">
              {results.map((hit) => (
                <li key={hit.document.path}>
                  <button
                    type="button"
                    data-testid="search-result"
                    className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[#f2f4f7]"
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
                Type to search the open project by title, path, text, or tags.
              </p>
            )}
            {workspace && q.trim() && results.length === 0 && (
              <p className="p-2 text-[#667085]">No matching documents.</p>
            )}
            {!workspace && (
              <div className="flex flex-col items-center gap-3 px-2 py-6 text-center" data-testid="search-empty">
                <p className="text-[12px] leading-5 text-[#667085]">
                  Open a project to search titles, paths, text and tags across your documents.
                </p>
                <button
                  type="button"
                  onClick={() => void useApp.getState().openFolder()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-2.5 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
                >
                  <FolderOpen size={14} aria-hidden /> Choose project
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
