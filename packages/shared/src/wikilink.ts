export interface WikiLinkParts {
  target: string;
  section?: string;
  label?: string;
  raw: string;
}

/** Accepts `[[target|label]]` and GFM-table `[[target\|label]]`. */
const WIKI_RE =
  /\[\[([^\]|#\n]+?)(?:#([^\]|\n]+?))?(?:\\?\|([^\]]+?))?\]\]/g;

function cleanWikiPart(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\\+$/g, "").trim();
  return cleaned || undefined;
}

export function parseWikiLinkInner(raw: string): WikiLinkParts | null {
  const match = new RegExp(`^${WIKI_RE.source}$`).exec(raw);
  if (!match) return null;
  return {
    target: cleanWikiPart(match[1]) ?? "",
    section: cleanWikiPart(match[2]),
    label: cleanWikiPart(match[3]),
    raw
  };
}

export function formatWikiLink(parts: WikiLinkParts): string {
  const section = parts.section ? `#${parts.section}` : "";
  const label = parts.label ? `|${parts.label}` : "";
  return `[[${parts.target}${section}${label}]]`;
}

export function extractWikiLinks(source: string): WikiLinkParts[] {
  const out: WikiLinkParts[] = [];
  const re = new RegExp(WIKI_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push({
      target: cleanWikiPart(m[1]) ?? "",
      section: cleanWikiPart(m[2]),
      label: cleanWikiPart(m[3]),
      raw: m[0]
    });
  }
  return out;
}

const FENCE_RE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[^\n]*?(?=\n|$)/g;

function maskFences(source: string): { masked: string; fences: string[] } {
  const fences: string[] = [];
  const masked = source.replace(FENCE_RE, (block) => {
    const i = fences.push(block) - 1;
    return `\n%%MDOC_FENCE_${i}%%\n`;
  });
  return { masked, fences };
}

function unmaskFences(source: string, fences: string[]): string {
  return source.replace(/%%MDOC_FENCE_(\d+)%%/g, (_, i) => fences[Number(i)] ?? "");
}

export const WIKI_SCHEME = "mdoc-wiki:";

export function encodeWikiHref(parts: WikiLinkParts): string {
  const section = parts.section ? `#${encodeURIComponent(parts.section)}` : "";
  return `${WIKI_SCHEME}${encodeURIComponent(parts.target)}${section}`;
}

export function decodeWikiHref(href: string): WikiLinkParts | null {
  if (!href.startsWith(WIKI_SCHEME)) return null;
  const rest = href.slice(WIKI_SCHEME.length);
  const hash = rest.indexOf("#");
  const targetEnc = hash === -1 ? rest : rest.slice(0, hash);
  const sectionEnc = hash === -1 ? undefined : rest.slice(hash + 1);
  return {
    target: decodeURIComponent(targetEnc),
    section: sectionEnc ? decodeURIComponent(sectionEnc) : undefined,
    raw: href
  };
}

/** Rewrite [[wikilinks]] to markdown links so MyST/CommonMark can parse them. */
export function rewriteWikiLinksToMarkdown(source: string): string {
  const { masked, fences } = maskFences(source);
  const rewritten = masked.replace(WIKI_RE, (raw, target, section, label) => {
    const parts: WikiLinkParts = {
      target: cleanWikiPart(String(target)) ?? "",
      section: cleanWikiPart(section ? String(section) : undefined),
      label: cleanWikiPart(label ? String(label) : undefined),
      raw
    };
    if (!parts.target) return raw;
    const text =
      parts.label ||
      (parts.section ? `${parts.target}#${parts.section}` : parts.target);
    return `[${text}](<${encodeWikiHref(parts)}>)`;
  });
  return unmaskFences(rewritten, fences);
}

export function rewriteMarkdownToWikiLinks(markdown: string): string {
  return markdown.replace(
    /\[([^\]]+)\]\(\s*<?(mdoc-wiki:[^)\s>]+)>?\s*\)/g,
    (_all, text: string, href: string) => {
      const decoded = decodeWikiHref(href);
      if (!decoded) return _all;
      const implicit =
        decoded.section ? `${decoded.target}#${decoded.section}` : decoded.target;
      if (!text || text === implicit) {
        return formatWikiLink({ ...decoded, label: undefined, raw: rawSafe(decoded) });
      }
      return formatWikiLink({ ...decoded, label: text, raw: rawSafe(decoded) });
    }
  );
}

function rawSafe(parts: WikiLinkParts): string {
  return formatWikiLink(parts);
}
