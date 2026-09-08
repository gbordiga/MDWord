"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@mdword/ui";
import {
  buildFileTree,
  expandFolderPathsForSelection,
  isOpenableWorkspaceFile,
  isSameWorkspacePath,
  workspaceFolderName,
  type FileTreeNode
} from "@mdword/workspace";

function allFolderPaths(nodes: FileTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FileTreeNode[]) => {
    for (const node of list) {
      if (!node.isDirectory) continue;
      out.push(node.path);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

function FileTypeIcon({
  name,
  isDirectory,
  open
}: {
  name: string;
  isDirectory: boolean;
  open?: boolean;
}) {
  const cls = "shrink-0";
  if (isDirectory) {
    const Icon = open ? FolderOpen : Folder;
    return <Icon size={16} className={cn(cls, "text-amber-600")} aria-hidden />;
  }
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  if (ext === "md" || ext === "markdown") {
    return <FileText size={16} className={cn(cls, "text-sky-700")} aria-hidden />;
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return <ImageIcon size={16} className={cn(cls, "text-emerald-700")} aria-hidden />;
  }
  if (ext === "json") {
    return <FileJson size={16} className={cn(cls, "text-amber-700")} aria-hidden />;
  }
  if (["yml", "yaml", "html", "css", "js", "ts", "mjs", "cjs"].includes(ext)) {
    return <FileCode size={16} className={cn(cls, "text-violet-700")} aria-hidden />;
  }
  return <File size={16} className={cn(cls, "text-[#667085]")} aria-hidden />;
}

function TreeRow({
  node,
  depth,
  expanded,
  currentPath,
  onToggle,
  onOpenFile
}: {
  node: FileTreeNode;
  depth: number;
  expanded: Set<string>;
  currentPath: string | null;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const open = node.isDirectory && expanded.has(node.path);
  const selected = !node.isDirectory && isSameWorkspacePath(node.path, currentPath);
  const openable = !node.isDirectory && isOpenableWorkspaceFile(node.name);
  const paddingLeft = 6 + depth * 12;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (node.isDirectory) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!open) onToggle(node.path);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (open) onToggle(node.path);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle(node.path);
      }
      return;
    }
    if (openable && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onOpenFile(node.path);
    }
  };

  return (
    <li role="treeitem" aria-expanded={node.isDirectory ? open : undefined} aria-selected={selected || undefined}>
      {node.isDirectory || openable ? (
        <button
          type="button"
          data-testid={node.isDirectory ? "workspace-folder" : "workspace-file"}
          data-path={node.path}
          data-kind={node.isDirectory ? "directory" : "file"}
          data-selected={selected ? "true" : undefined}
          aria-expanded={node.isDirectory ? open : undefined}
          aria-current={selected ? "page" : undefined}
          aria-selected={selected || undefined}
          title={node.name}
          style={{ paddingLeft }}
          className={cn(
            "flex w-full min-h-8 items-center gap-1 rounded py-1 pr-1 text-left touch-manipulation",
            selected
              ? "bg-[#e8eefc] font-medium text-accent shadow-[inset_2px_0_0_0_currentColor]"
              : "text-[#1c1f24] hover:bg-[#f2f4f7]"
          )}
          onClick={() => (node.isDirectory ? onToggle(node.path) : onOpenFile(node.path))}
          onKeyDown={onKeyDown}
        >
          {node.isDirectory ? (
            open ? (
              <ChevronDown size={14} className="shrink-0 text-[#667085]" aria-hidden />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-[#667085]" aria-hidden />
            )
          ) : (
            <span className="inline-block w-3.5 shrink-0" />
          )}
          <FileTypeIcon name={node.name} isDirectory={node.isDirectory} open={open} />
          <span className="min-w-0 truncate">{node.name}</span>
        </button>
      ) : (
        <div
          data-testid="workspace-file"
          data-path={node.path}
          data-kind="file"
          title={`${node.name} cannot be opened in MDWord`}
          style={{ paddingLeft }}
          className="flex w-full min-h-8 cursor-default items-center gap-1 rounded py-1 pr-1 text-[#667085]"
        >
          <span className="inline-block w-3.5 shrink-0" />
          <FileTypeIcon name={node.name} isDirectory={false} />
          <span className="min-w-0 truncate">{node.name}</span>
        </div>
      )}
      {node.isDirectory && open && node.children.length > 0 ? (
        <ul role="group">
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              currentPath={currentPath}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FileTree({
  files,
  root,
  currentPath,
  onOpenFile
}: {
  files: { path: string; name: string; isDirectory: boolean }[];
  root: string;
  currentPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(files, root), [files, root]);
  const lastRoot = useRef(root);
  const [expanded, setExpanded] = useState(() => new Set(allFolderPaths(tree)));

  useEffect(() => {
    setExpanded((prev) => {
      if (lastRoot.current !== root) {
        lastRoot.current = root;
        return new Set(allFolderPaths(tree));
      }
      const next = new Set(prev);
      for (const path of expandFolderPathsForSelection(tree, currentPath)) next.add(path);
      return next;
    });
  }, [root, tree, currentPath]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div data-testid="workspace-files">
      <div
        data-testid="workspace-root"
        className="mb-1 flex items-center gap-1.5 px-1 py-1.5 text-[13px] font-medium text-[#1c1f24]"
        title={root}
      >
        <FolderOpen size={16} className="shrink-0 text-amber-600" aria-hidden />
        <span className="min-w-0 truncate">{workspaceFolderName(root)}</span>
      </div>
      {tree.length === 0 ? (
        <p className="p-2 text-[#667085]">This folder is empty.</p>
      ) : (
        <ul role="tree" aria-label={`Files in ${workspaceFolderName(root)}`}>
          {tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              currentPath={currentPath}
              onToggle={toggle}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
