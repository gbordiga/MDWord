import { isMarkdownFileName } from "@mdword/shared";
import { indexMarkdown, type WorkspaceIndex } from "@mdword/indexer";
import type { Mdoc } from "@mdword/layout-engine";

export interface WorkspaceFileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface WorkspaceSnapshot {
  root: string | null;
  files: WorkspaceFileEntry[];
  index: WorkspaceIndex;
  workspaceMdoc: Mdoc | undefined;
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** True when `filePath` is in the open workspace (or is a basename-only web save). */
export function isInsideWorkspace(filePath: string, root: string | null | undefined): boolean {
  if (!root || !filePath) return false;
  const file = normalize(filePath);
  const base = normalize(root);
  if (file === base) return true;
  if (file.startsWith(`${base}/`)) return true;
  if (!file.includes("/")) return true;
  return false;
}

export function upsertWorkspaceFile(
  files: WorkspaceFileEntry[],
  entry: WorkspaceFileEntry
): WorkspaceFileEntry[] {
  const pathKey = normalize(entry.path);
  const nameKey = entry.name.toLowerCase();
  const index = files.findIndex(
    (f) => normalize(f.path) === pathKey || f.name.toLowerCase() === nameKey
  );
  if (index >= 0) {
    const next = files.slice();
    next[index] = { ...files[index], ...entry };
    return next;
  }
  return [...files, entry].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Merge a just-saved markdown file into the in-memory workspace so the sidebar updates immediately. */
export function applySavedDocument(
  workspace: WorkspaceSnapshot,
  filePath: string,
  content: string
): WorkspaceSnapshot {
  if (!isInsideWorkspace(filePath, workspace.root)) return workspace;
  const name = basename(filePath);
  if (!isMarkdownFileName(name)) return workspace;
  const fullPath =
    filePath.includes("/") || filePath.includes("\\")
      ? filePath
      : `${workspace.root}/${name}`;
  const files = upsertWorkspaceFile(workspace.files, {
    path: fullPath,
    name,
    isDirectory: false
  });
  const indexed = indexMarkdown(fullPath, content, Date.now());
  const documents = [
    ...workspace.index.documents.filter((d) => {
      const p = normalize(d.path);
      return p !== normalize(fullPath) && p !== normalize(filePath) && basename(d.path).toLowerCase() !== name.toLowerCase();
    }),
    indexed
  ];
  return { ...workspace, files, index: { documents } };
}
