"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  File,
  FileCode,
  FileJson,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@mdword/ui";
import {
  buildFileTree,
  expandFolderPathsForSelection,
  isOpenableWorkspaceFile,
  isSameWorkspacePath,
  targetFolderPath,
  uniqueChildName,
  childNamesInFolder,
  workspaceFolderName,
  workspaceParentPath,
  type FileTreeNode
} from "@mdword/workspace";
import { useApp } from "@/lib/store";
import { Dialog, DialogButton, DialogField, dialogInputClass } from "./Dialog";

type MenuTarget = {
  path: string;
  name: string;
  isDirectory: boolean;
  isRoot?: boolean;
};

type NameDialog = {
  mode: "file" | "folder" | "rename";
  parentPath: string;
  fromPath?: string;
  initial: string;
};

type ClipboardEntry = {
  path: string;
  name: string;
  isDirectory: boolean;
};

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
  onOpenFile,
  onContextMenu
}: {
  node: FileTreeNode;
  depth: number;
  expanded: Set<string>;
  currentPath: string | null;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenu: (event: ReactMouseEvent, target: MenuTarget) => void;
}) {
  const open = node.isDirectory && expanded.has(node.path);
  const selected = !node.isDirectory && isSameWorkspacePath(node.path, currentPath);
  const openable = !node.isDirectory && isOpenableWorkspaceFile(node.name);
  const paddingLeft = 6 + depth * 12;
  const target: MenuTarget = { path: node.path, name: node.name, isDirectory: node.isDirectory };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
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

  const rowClass = cn(
    "flex w-full min-h-8 items-center gap-1 rounded py-1 pr-1 text-left touch-manipulation",
    selected
      ? "bg-[#e8eefc] font-medium text-accent shadow-[inset_2px_0_0_0_currentColor]"
      : "text-[#1c1f24] hover:bg-[#f2f4f7]"
  );

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
          className={rowClass}
          onClick={() => (node.isDirectory ? onToggle(node.path) : onOpenFile(node.path))}
          onContextMenu={(event) => onContextMenu(event, target)}
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
          className={cn(rowClass, "cursor-default text-[#667085]")}
          onContextMenu={(event) => onContextMenu(event, target)}
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
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ToolbarButton({
  title,
  testId,
  onClick,
  children
}: {
  title: string;
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      data-testid={testId}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[#344054] hover:bg-[#f2f4f7] hover:text-[#1c1f24] lg:h-8 lg:w-8"
    >
      {children}
    </button>
  );
}

function FileContextMenu({
  x,
  y,
  target,
  canPaste,
  onClose,
  onAction
}: {
  x: number;
  y: number;
  target: MenuTarget;
  canPaste: boolean;
  onClose: () => void;
  onAction: (action: "file" | "folder" | "rename" | "copy" | "paste" | "delete") => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + box.width > window.innerWidth - 8) left = window.innerWidth - box.width - 8;
    if (top + box.height > window.innerHeight - 8) top = window.innerHeight - box.height - 8;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }, [x, y]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const item = (
    action: "file" | "folder" | "rename" | "copy" | "paste" | "delete",
    label: string,
    disabled?: boolean
  ) => (
    <button
      type="button"
      role="menuitem"
      data-testid={`workspace-menu-${action}`}
      disabled={disabled}
      className={cn(
        "flex w-full items-center px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:text-[#98a2b3] disabled:hover:bg-transparent",
        action === "delete"
          ? "text-[#b42318] hover:bg-[#fef3f2]"
          : "text-[#1c1f24] hover:bg-[#f2f4f7]"
      )}
      onClick={() => {
        if (disabled) return;
        onAction(action);
      }}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-testid="workspace-context-menu"
      className="fixed z-[70] min-w-44 rounded-lg border border-[#e4e7ec] bg-white py-1 shadow-[0_8px_24px_rgb(16_24_40_/_18%)]"
      style={{ left: x, top: y }}
    >
      {item("file", "New file")}
      {item("folder", "New folder")}
      <div className="my-1 border-t border-[#e4e7ec]" />
      {item("rename", "Rename", Boolean(target.isRoot))}
      {item("copy", "Copy", Boolean(target.isRoot))}
      {item("paste", "Paste", !canPaste)}
      <div className="my-1 border-t border-[#e4e7ec]" />
      {item("delete", "Delete", Boolean(target.isRoot))}
    </div>,
    document.body
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
  const [activeFolder, setActiveFolder] = useState(root);
  const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MenuTarget | null>(null);

  useEffect(() => {
    setActiveFolder(root);
  }, [root]);

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
    setActiveFolder(path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandFolder = (folderPath: string) => {
    setActiveFolder(folderPath);
    setExpanded((prev) => new Set(prev).add(folderPath));
  };

  const rootTarget: MenuTarget = {
    path: root,
    name: workspaceFolderName(root),
    isDirectory: true,
    isRoot: true
  };

  const openMenu = (event: ReactMouseEvent, target: MenuTarget) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, target });
    setActiveFolder(targetFolderPath(target, root));
  };

  const suggestedName = (mode: "file" | "folder", parentPath: string) => {
    const wanted = mode === "file" ? "Untitled.md" : "New folder";
    return uniqueChildName(childNamesInFolder(files, parentPath, root), wanted);
  };

  const openNameDialog = (mode: NameDialog["mode"], target: MenuTarget) => {
    const parentPath = mode === "rename" ? workspaceParentPath(target.path, root) : targetFolderPath(target, root);
    const initial = mode === "rename" ? target.name : suggestedName(mode, parentPath);
    setNameDialog({
      mode,
      parentPath,
      fromPath: mode === "rename" ? target.path : undefined,
      initial
    });
    setNameValue(initial);
    setNameError(null);
  };

  const submitName = async () => {
    if (!nameDialog) return;
    const actions = useApp.getState();
    setBusy(true);
    setNameError(null);
    try {
      if (nameDialog.mode === "file") {
        const dest = await actions.createWorkspaceFile(nameDialog.parentPath, nameValue);
        expandFolder(nameDialog.parentPath);
        setNameDialog(null);
        if (isOpenableWorkspaceFile(dest.split(/[/\\]/).pop() || dest)) onOpenFile(dest);
        return;
      }
      if (nameDialog.mode === "folder") {
        const dest = await actions.createWorkspaceFolder(nameDialog.parentPath, nameValue);
        expandFolder(nameDialog.parentPath);
        expandFolder(dest);
        setNameDialog(null);
        return;
      }
      if (nameDialog.fromPath) {
        await actions.renameWorkspaceEntry(nameDialog.fromPath, nameValue);
        setNameDialog(null);
      }
    } catch (err) {
      setNameError(err instanceof Error && err.message ? err.message : "Could not complete the action");
    } finally {
      setBusy(false);
    }
  };

  const pasteInto = async (target: MenuTarget) => {
    if (!clipboard) return;
    const parentPath = targetFolderPath(target, root);
    setBusy(true);
    try {
      await useApp.getState().copyWorkspaceEntry(clipboard.path, parentPath);
      expandFolder(parentPath);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not paste");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await useApp.getState().deleteWorkspaceEntry(pendingDelete.path);
      setPendingDelete(null);
    } catch (err) {
      setPendingDelete(null);
      setError(err instanceof Error && err.message ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const onMenuAction = (action: "file" | "folder" | "rename" | "copy" | "paste" | "delete") => {
    if (!menu) return;
    const { target } = menu;
    setMenu(null);
    if (action === "copy") {
      if (target.isRoot) return;
      setClipboard({ path: target.path, name: target.name, isDirectory: target.isDirectory });
      return;
    }
    if (action === "paste") {
      void pasteInto(target);
      return;
    }
    if (action === "delete") {
      if (target.isRoot) return;
      setPendingDelete(target);
      return;
    }
    openNameDialog(action, target);
  };

  const dialogTitle =
    nameDialog?.mode === "file" ? "New file" : nameDialog?.mode === "folder" ? "New folder" : "Rename";

  return (
    <div
      data-testid="workspace-files"
      onContextMenu={(event) => openMenu(event, rootTarget)}
    >
      <div className="sticky top-0 z-10 -mx-2 mb-1 bg-white px-2 pb-1">
        <div className="flex items-center gap-0.5">
          <div
            data-testid="workspace-root"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1.5 text-[13px] font-medium text-[#1c1f24]"
            title={root}
            onContextMenu={(event) => openMenu(event, rootTarget)}
          >
            <FolderOpen size={16} className="shrink-0 text-amber-600" aria-hidden />
            <span className="min-w-0 truncate">{workspaceFolderName(root)}</span>
          </div>
          <ToolbarButton
            title="Collapse all"
            testId="workspace-collapse-all"
            onClick={() => setExpanded(new Set())}
          >
            <ChevronsDownUp size={16} />
          </ToolbarButton>
          <ToolbarButton
            title="New folder"
            testId="workspace-new-folder"
            onClick={() => openNameDialog("folder", { path: activeFolder, name: "", isDirectory: true })}
          >
            <FolderPlus size={16} />
          </ToolbarButton>
          <ToolbarButton
            title="New file"
            testId="workspace-new-file"
            onClick={() => openNameDialog("file", { path: activeFolder, name: "", isDirectory: true })}
          >
            <FilePlus size={16} />
          </ToolbarButton>
        </div>
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
              onOpenFile={(path) => {
                setActiveFolder(workspaceParentPath(path, root));
                onOpenFile(path);
              }}
              onContextMenu={openMenu}
            />
          ))}
        </ul>
      )}
      {menu ? (
        <FileContextMenu
          x={menu.x}
          y={menu.y}
          target={menu.target}
          canPaste={Boolean(clipboard)}
          onClose={() => setMenu(null)}
          onAction={onMenuAction}
        />
      ) : null}
      <Dialog
        open={Boolean(nameDialog)}
        title={dialogTitle}
        onClose={() => (busy ? undefined : setNameDialog(null))}
        testId="workspace-name-dialog"
        footer={
          <>
            <DialogButton onClick={() => setNameDialog(null)} disabled={busy}>
              Cancel
            </DialogButton>
            <DialogButton variant="primary" onClick={() => void submitName()} disabled={busy || !nameValue.trim()}>
              {nameDialog?.mode === "rename" ? "Rename" : "Create"}
            </DialogButton>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitName();
          }}
        >
          <DialogField label="Name">
            <input
              data-testid="workspace-name-input"
              className={dialogInputClass}
              value={nameValue}
              onChange={(event) => {
                setNameValue(event.target.value);
                setNameError(null);
              }}
            />
          </DialogField>
        </form>
        {nameError ? <p className="text-[13px] text-[#b42318]">{nameError}</p> : null}
      </Dialog>
      <Dialog
        open={Boolean(error)}
        title="Could not complete"
        onClose={() => setError(null)}
        testId="workspace-error-dialog"
        footer={
          <DialogButton variant="primary" onClick={() => setError(null)}>
            OK
          </DialogButton>
        }
      >
        <p className="text-[13px] text-[#344054]">{error}</p>
      </Dialog>
      <Dialog
        open={Boolean(pendingDelete)}
        title="Delete"
        onClose={() => (busy ? undefined : setPendingDelete(null))}
        testId="workspace-delete-dialog"
        footer={
          <>
            <DialogButton onClick={() => setPendingDelete(null)} disabled={busy}>
              Cancel
            </DialogButton>
            <DialogButton variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
              Delete
            </DialogButton>
          </>
        }
      >
        <p className="text-[13px] text-[#344054]">
          {pendingDelete?.isDirectory
            ? `Delete “${pendingDelete.name}” and everything inside it?`
            : `Delete “${pendingDelete?.name}”?`}
        </p>
      </Dialog>
    </div>
  );
}
