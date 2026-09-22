import { stripTrailingSeps } from "./strings";

/** POSIX-style relative path helpers. Never talk to the filesystem here. */

export function normalizeDocPath(input: string): string {
  const replaced = input.replace(/\\/g, "/").replace(/^\.\//, "");
  const parts: string[] = [];
  for (const part of replaced.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        throw new Error("Path escapes its root");
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

export function stripMdExtension(filePath: string): string {
  return filePath.replace(/\.md$/i, "");
}

export function ensureMdExtension(filePath: string): string {
  return /\.md$/i.test(filePath) ? filePath : `${filePath}.md`;
}

export function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i === -1 ? normalized : normalized.slice(i + 1);
}

export function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i === -1 ? "" : normalized.slice(0, i);
}

export function joinPath(...parts: string[]): string {
  return normalizeDocPath(parts.filter(Boolean).join("/"));
}

export function headingSlug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url);
}

export function isAbsoluteFilePath(path: string): boolean {
  const value = path.replace(/\\/g, "/");
  return value.startsWith("/") || /^[a-zA-Z]:\//.test(value);
}

export function imageMimeFromPath(filePath: string): string {
  const ext = filePath.split(/[/\\.]/).pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}

/** Resolve a document-relative or workspace-relative image path. */
export function resolveExternalImagePath(
  src: string,
  documentPath: string | null,
  workspaceRoot?: string | null
): string | null {
  let value = src.trim();
  if (!value) return null;
  value = value.replace(/^file:\/\//i, "");
  if (/^\/[a-zA-Z]:\//.test(value)) value = value.slice(1);
  value = value.replace(/\\/g, "/");
  if (isHttpUrl(value)) return null;
  try {
    if (isAbsoluteFilePath(value)) return value;
    const base = documentPath ? dirname(documentPath) : workspaceRoot ?? "";
    if (!base) return value;
    const rel = normalizeDocPath(value);
    const prefix = stripTrailingSeps(base);
    const sep = prefix.includes("\\") ? "\\" : "/";
    return `${prefix}${sep}${rel.replace(/\//g, sep === "\\" ? "\\" : "/")}`;
  } catch {
    return null;
  }
}
