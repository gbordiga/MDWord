const TITLE_KEYS = ["title", "titolo", "name", "nome"] as const;

export type DocumentTitleKey = (typeof TITLE_KEYS)[number];

export function documentTitleKey(
  frontmatter: Record<string, unknown> | null | undefined
): DocumentTitleKey {
  if (!frontmatter) return "title";
  for (const key of TITLE_KEYS) {
    const value = frontmatter[key];
    if (typeof value === "string" && value.trim()) return key;
  }
  return "title";
}

export function documentTitle(
  frontmatter: Record<string, unknown> | null | undefined,
  fallback = "Untitled"
): string {
  if (!frontmatter) return fallback;
  const key = documentTitleKey(frontmatter);
  const value = frontmatter[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function titleFromPath(path: string | null | undefined, fallback = "Untitled"): string {
  if (!path) return fallback;
  const base = path.split(/[/\\]/).pop() ?? path;
  const stem = base.replace(/\.(md|markdown)$/i, "").trim();
  return stem || fallback;
}

export function displayDocumentTitle(
  frontmatter: Record<string, unknown> | null | undefined,
  path?: string | null
): string {
  return documentTitle(frontmatter, titleFromPath(path));
}
