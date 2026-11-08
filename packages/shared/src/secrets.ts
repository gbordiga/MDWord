export function maskKey(key: string): string {
  if (key.length <= 8) return "\u2022\u2022\u2022\u2022";
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}

/** Keys look like `sk-or-v1-...`; refuse obvious non-keys before storing. */
export function looksLikeKey(value: string): boolean {
  return /^sk-or-[A-Za-z0-9_-]{16,}$/.test(value.trim());
}

/** Remove anything that looks like a key from text that may be logged or shown. */
export function redactKeys(text: string): string {
  return text.replace(/sk-or-[A-Za-z0-9_-]{8,}/g, "sk-or-\u2026");
}
