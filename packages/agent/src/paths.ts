export type PathResult = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Validate a model-supplied path and return it as a clean workspace-relative
 * POSIX path. The empty string is the workspace root. Absolute paths, drive
 * letters, `..` segments, and NUL bytes are rejected, so the tool layer never
 * hands the host anything outside the root. Symlinks are the host's concern.
 */
export function normalizeWorkspacePath(input: string): PathResult {
  if (input.includes("\0")) return { ok: false, reason: "The path contains an invalid character." };
  const slashed = input.trim().replace(/\\/g, "/");
  if (slashed.startsWith("/") || /^[A-Za-z]:/.test(slashed) || slashed.startsWith("~")) {
    return {
      ok: false,
      reason: "Use a path relative to the workspace root, such as notes/ideas.md."
    };
  }
  const out: string[] = [];
  for (const segment of slashed.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      return { ok: false, reason: "The path must stay inside the workspace (no '..')." };
    }
    out.push(segment);
  }
  return { ok: true, path: out.join("/") };
}
