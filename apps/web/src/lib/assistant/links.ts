const ALLOWED = new Set(["http:", "https:", "mailto:"]);

/** Only web and mail links from model output become clickable. */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href.trim());
    return ALLOWED.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
