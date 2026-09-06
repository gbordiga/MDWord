/** Return a safe href, or null if the value is empty or a dangerous protocol. */
export function normalizeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith("#") || href.startsWith("mailto:")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("//")) return null;
  if (/^(javascript|data|vbscript|file):/i.test(href)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  const pathOnly = href.split(/[?#]/)[0] ?? href;
  const looksLikeFile = /\.(md|markdown|png|jpe?g|gif|svg|webp|pdf|txt|html?|css|js|ts|json|csv|mp4|mov)$/i.test(
    pathOnly
  );
  if (!looksLikeFile && /^(www\.)?[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(href)) {
    return `https://${href}`;
  }
  return href;
}
