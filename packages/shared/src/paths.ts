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

/** Decode %20 and friends in file paths. Leaves data, blob, and http URLs alone. */
export function decodeFileUrl(url: string): string {
  const value = url.trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:") || isHttpUrl(value)) return value;
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Join a relative path onto a directory, including `..`.
 * A Windows drive letter is never popped. Returns null if `..` escapes the drive or the root.
 */
export function resolveAgainstDirectory(base: string, relative: string): string | null {
  const rel = decodeFileUrl(relative).replace(/\\/g, "/");
  if (isAbsoluteFilePath(rel)) return rel;
  const normalizedBase = stripTrailingSeps(base).replace(/\\/g, "/");
  if (!normalizedBase) return rel || null;
  const baseParts = normalizedBase.split("/").filter((part) => part.length > 0);
  const drive = /^[a-zA-Z]:$/.test(baseParts[0] ?? "") ? baseParts.shift()! : null;
  const leadingSlash = normalizedBase.startsWith("/");
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (baseParts.length === 0) return null;
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }
  const body = baseParts.join("/");
  if (drive) return body ? `${drive}/${body}` : `${drive}/`;
  if (leadingSlash) return `/${body}`;
  return body || null;
}

/** Resolve a document-relative or workspace-relative image path. */
export function resolveExternalImagePath(
  src: string,
  documentPath: string | null,
  workspaceRoot?: string | null
): string | null {
  let value = decodeFileUrl(src);
  if (!value) return null;
  value = value.replace(/^file:\/\//i, "");
  if (/^\/[a-zA-Z]:\//.test(value)) value = value.slice(1);
  value = value.replace(/\\/g, "/");
  if (isHttpUrl(value)) return null;
  if (isAbsoluteFilePath(value)) return value;
  const base = documentPath ? dirname(documentPath) : workspaceRoot ?? "";
  if (!base) return value;
  return resolveAgainstDirectory(base, value);
}
