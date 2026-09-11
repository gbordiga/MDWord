import { relativeWorkspacePath } from "./tree";

export function workspaceUsesWinSep(root: string): boolean {
  return root.includes("\\") || /^[a-zA-Z]:/.test(root);
}

/** Join segments onto a workspace root, keeping Windows or POSIX separators. */
export function joinWorkspacePath(root: string, ...parts: string[]): string {
  const sep = workspaceUsesWinSep(root) ? "\\" : "/";
  const extra: string[] = [];
  for (const part of parts) {
    for (const bit of String(part).replace(/\\/g, "/").split("/")) {
      if (!bit || bit === ".") continue;
      if (bit === "..") throw new Error("Path escapes its root");
      extra.push(bit);
    }
  }
  const prefix = root.replace(/[\\/]+$/, "");
  if (extra.length === 0) return prefix;
  return `${prefix}${sep}${extra.join(sep)}`;
}

export function workspaceEntryName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

export function workspaceParentPath(filePath: string, root: string): string {
  const rel = relativeWorkspacePath(filePath, root);
  if (rel == null || rel === "") return root;
  const slash = rel.lastIndexOf("/");
  if (slash < 0) return root;
  return joinWorkspacePath(root, rel.slice(0, slash));
}

export function isValidWorkspaceEntryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return false;
  if (/[\\/:*?"<>|]/.test(trimmed)) return false;
  return trimmed.length <= 200;
}

export function uniqueChildName(existing: string[], wanted: string): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const name = wanted.trim();
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : "";
  for (let i = 2; i < 500; i++) {
    const next = `${base} (${i})${ext}`;
    if (!taken.has(next.toLowerCase())) return next;
  }
  return `${base} (${Date.now()})${ext}`;
}

export function childNamesInFolder(
  files: { path: string; name: string }[],
  parentPath: string,
  root: string
): string[] {
  const parentRel = relativeWorkspacePath(parentPath, root);
  if (parentRel == null) return [];
  const names: string[] = [];
  for (const file of files) {
    const rel = relativeWorkspacePath(file.path, root);
    if (rel == null || rel === "") continue;
    if (isDirectChildRel(rel, parentRel)) names.push(file.name);
  }
  return names;
}

function isDirectChildRel(rel: string, parentRel: string): boolean {
  if (parentRel === "") return !rel.includes("/");
  const prefix = `${parentRel}/`;
  if (!rel.toLowerCase().startsWith(prefix.toLowerCase())) return false;
  return !rel.slice(parentRel.length + 1).includes("/");
}

/** Folder that should receive a new child of `target` (the folder itself, or a file's parent). */
export function targetFolderPath(
  target: { path: string; isDirectory: boolean },
  root: string
): string {
  return target.isDirectory ? target.path : workspaceParentPath(target.path, root);
}

/** True when `current` is `ancestor` or a file/folder inside it. */
export function isPathOrDescendant(current: string, ancestor: string): boolean {
  const c = current.replace(/\\/g, "/").toLowerCase();
  const a = ancestor.replace(/\\/g, "/").toLowerCase();
  return c === a || c.startsWith(`${a}/`);
}

/** Update an open path after a rename or move of `from` → `to`. */
export function rewriteWorkspacePath(current: string, from: string, to: string): string {
  const c = current.replace(/\\/g, "/");
  const f = from.replace(/\\/g, "/");
  if (c.toLowerCase() === f.toLowerCase()) return to;
  if (c.toLowerCase().startsWith(`${f.toLowerCase()}/`)) {
    const rest = current.slice(from.length).replace(/^[\\/]+/, "");
    return joinWorkspacePath(to, rest);
  }
  return current;
}

/** Add `.md` when the user omitted an extension. */
export function normalizeNewFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const dot = trimmed.lastIndexOf(".");
  if (dot > 0 && dot < trimmed.length - 1) return trimmed;
  return `${trimmed}.md`;
}
