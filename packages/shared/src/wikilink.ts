import { stripTrailingBackslashes } from "./strings";

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
  const cleaned = stripTrailingBackslashes(value).trim();
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

function maskFences(source: string): { masked: string; fences: string[] } {
  const fences: string[] = [];
  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const marker = line.startsWith("```") ? "```" : line.startsWith("~~~") ? "~~~" : "";
    if (!marker) {
      out.push(line);
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    while (i < lines.length && !(lines[i] ?? "").startsWith(marker)) i += 1;
    if (i < lines.length) i += 1;
    const idx = fences.push(lines.slice(start, i).join("\n")) - 1;
    out.push(`%%MDOC_FENCE_${idx}%%`);
  }
  return { masked: out.join("\n"), fences };
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

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\t";
}

function rewriteWikiMarkdownAt(markdown: string, i: number): { replacement: string; end: number } | null {
  if (markdown[i] !== "[") return null;
  const textEnd = markdown.indexOf("]", i + 1);
  if (textEnd < 0 || markdown[textEnd + 1] !== "(") return null;
  let j = textEnd + 2;
  while (j < markdown.length && isSpace(markdown[j] ?? "")) j += 1;
  if (markdown[j] === "<") j += 1;
  if (!markdown.startsWith(WIKI_SCHEME, j)) return null;
  let k = j;
  while (k < markdown.length) {
    const ch = markdown[k] ?? "";
    if (ch === ")" || ch === ">" || isSpace(ch)) break;
    k += 1;
  }
  const href = markdown.slice(j, k);
  if (markdown[k] === ">") k += 1;
  while (k < markdown.length && isSpace(markdown[k] ?? "")) k += 1;
  if (markdown[k] !== ")") return null;
  const text = markdown.slice(i + 1, textEnd);
  const all = markdown.slice(i, k + 1);
  const decoded = decodeWikiHref(href);
  if (!decoded) return { replacement: all, end: k + 1 };
  const implicit = decoded.section ? `${decoded.target}#${decoded.section}` : decoded.target;
  const replacement =
    !text || text === implicit
      ? formatWikiLink({ ...decoded, label: undefined, raw: rawSafe(decoded) })
      : formatWikiLink({ ...decoded, label: text, raw: rawSafe(decoded) });
  return { replacement, end: k + 1 };
}

export function rewriteMarkdownToWikiLinks(markdown: string): string {
  let out = "";
  let i = 0;
  while (i < markdown.length) {
    const hit = rewriteWikiMarkdownAt(markdown, i);
    if (hit) {
      out += hit.replacement;
      i = hit.end;
      continue;
    }
    out += markdown[i];
    i += 1;
  }
  return out;
}

function rawSafe(parts: WikiLinkParts): string {
  return formatWikiLink(parts);
}
