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

const DATE_KEYS = ["date", "data"] as const;

function isoDay(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
}

/** Normalize YAML timestamps and Italian `data` into `YYYY-MM-DD`. */
export function documentDate(
  frontmatter: Record<string, unknown> | null | undefined
): string {
  if (!frontmatter) return "";
  let raw: unknown;
  for (const key of DATE_KEYS) {
    if (frontmatter[key] != null && frontmatter[key] !== "") {
      raw = frontmatter[key];
      break;
    }
  }
  if (raw == null || raw === "") return "";
  if (raw instanceof Date) return isoDay(raw);
  if (typeof raw === "number") return isoDay(new Date(raw));
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const day = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
    if (day) return day[1] ?? "";
    return trimmed;
  }
  return "";
}
