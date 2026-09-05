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
