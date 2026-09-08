import { isMarkdownFileName } from "@mdword/shared";
import type { WorkspaceFileEntry } from "./files";

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
}

function posix(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

function parentPath(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (slash <= 0) return filePath;
  return filePath.slice(0, slash);
}

/** Relative POSIX path from the open folder, or null if the entry is outside it. */
export function relativeWorkspacePath(filePath: string, root: string): string | null {
  const f = posix(filePath);
  const r = posix(root);
  if (!f || !r) return null;
  if (f.toLowerCase() === r.toLowerCase()) return "";
  if (f.toLowerCase().startsWith(`${r.toLowerCase()}/`)) {
    return f.slice(r.length + 1);
  }
  if (!f.startsWith("/") && !/^[a-zA-Z]:/.test(filePath)) {
    return f;
  }
  return null;
}

function pathForDepth(fullPath: string, relParts: string[], depth: number): string {
  const remaining = relParts.length - depth;
  let p = fullPath;
  for (let i = 0; i < remaining; i++) p = parentPath(p);
  return p;
}

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const sorted = nodes.slice().sort(compareNodes);
  for (const n of sorted) {
    if (n.children.length) n.children = sortTree(n.children);
  }
  return sorted;
}

/** Nested tree of the open folder. The folder itself is the implicit root, not a child. */
export function buildFileTree(
  files: WorkspaceFileEntry[],
  root: string | null | undefined
): FileTreeNode[] {
  if (!root) return [];
  const byRel = new Map<string, FileTreeNode>();
  const top: FileTreeNode[] = [];

  const ensure = (rel: string, name: string, path: string, isDirectory: boolean): FileTreeNode => {
    const existing = byRel.get(rel);
    if (existing) {
      existing.path = path;
      if (isDirectory) existing.isDirectory = true;
      else if (existing.children.length === 0) existing.isDirectory = isDirectory;
      return existing;
    }
    const node: FileTreeNode = { name, path, isDirectory, children: [] };
    byRel.set(rel, node);
    const parentRel = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    if (!parentRel) top.push(node);
    else byRel.get(parentRel)?.children.push(node);
    return node;
  };

  for (const entry of files) {
    const rel = relativeWorkspacePath(entry.path, root);
    if (rel == null || rel === "") continue;
    const parts = rel.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      const isLast = i === parts.length - 1;
      const isDirectory = isLast ? entry.isDirectory : true;
      const nodePath = isLast ? entry.path : pathForDepth(entry.path, parts, i + 1);
      ensure(acc, part, nodePath, isDirectory);
    }
  }

  return sortTree(top);
}

export function isSameWorkspacePath(a: string, b: string | null | undefined): boolean {
  if (!b) return false;
  const na = posix(a).toLowerCase();
  const nb = posix(b).toLowerCase();
  if (na === nb) return true;
  const ba = na.split("/").pop() ?? na;
  const bb = nb.split("/").pop() ?? nb;
  if (ba !== bb) return false;
  if (!nb.includes("/")) return na === nb || na.endsWith(`/${nb}`);
  if (!na.includes("/")) return nb.endsWith(`/${na}`);
  return false;
}

export function expandFolderPathsForSelection(
  tree: FileTreeNode[],
  currentPath: string | null | undefined
): string[] {
  const found: string[] = [];
  const walk = (nodes: FileTreeNode[], ancestors: string[]): boolean => {
    for (const node of nodes) {
      if (node.isDirectory) {
        if (walk(node.children, [...ancestors, node.path])) return true;
      } else if (isSameWorkspacePath(node.path, currentPath)) {
        found.push(...ancestors);
        return true;
      }
    }
    return false;
  };
  walk(tree, []);
  return found;
}

export function isOpenableWorkspaceFile(name: string): boolean {
  return isMarkdownFileName(name);
}

export function workspaceFolderName(root: string): string {
  const trimmed = posix(root);
  return trimmed.split("/").pop() || root;
}
