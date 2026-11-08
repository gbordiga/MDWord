import { toPosixPath } from "./strings";

export const MAX_RECENT_FILES = 10;

/** Windows and drive-letter paths compare case-insensitively; POSIX paths do not. */
function recentKey(value: string): string {
  const normalized = toPosixPath(value.trim());
  return /^[a-zA-Z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

/** Most recent first, no duplicates, capped. An empty candidate is ignored. */
export function rememberRecentFile(
  existing: readonly string[],
  next: string,
  limit = MAX_RECENT_FILES
): string[] {
  const target = next.trim();
  if (!target) return [...existing];
  const key = recentKey(target);
  const rest = existing.filter((entry) => typeof entry === "string" && recentKey(entry) !== key);
  return [target, ...rest].slice(0, Math.max(1, limit));
}

export function isRecentFile(existing: readonly string[], candidate: string): boolean {
  const key = recentKey(candidate);
  if (!key) return false;
  return existing.some((entry) => typeof entry === "string" && recentKey(entry) === key);
}

/** Only the plain strings, in order, so preferences cannot inject other types. */
export function sanitizeRecentFiles(value: unknown, limit = MAX_RECENT_FILES): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    if (out.some((known) => recentKey(known) === recentKey(entry))) continue;
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
