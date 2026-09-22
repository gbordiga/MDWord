import {
  extractWikiLinks,
  headingSlug,
  stripMdExtension,
  basename,
  documentTitle
} from "@mdword/shared";
import { extractFrontmatter, yamlToPlain } from "@mdword/myst-parser";

export interface IndexedDocument {
  path: string;
  title: string;
  aliases: string[];
  headings: { text: string; slug: string; depth: number }[];
  tags: string[];
  wikilinks: { target: string; section?: string; label?: string }[];
  plainText: string;
  modifiedMs: number;
}

export interface WorkspaceIndex {
  documents: IndexedDocument[];
}

function isFenceLine(line: string): boolean {
  return line.startsWith("```") || line.startsWith("~~~");
}

function parseAtxHeading(line: string): { depth: number; text: string } | null {
  let depth = 0;
  while (depth < line.length && depth < 6 && line.charCodeAt(depth) === 35) depth += 1;
  if (depth === 0) return null;
  const after = line[depth];
  if (after !== " " && after !== "\t") return null;
  let end = line.length;
  while (end > depth + 1 && (line.charCodeAt(end - 1) === 32 || line.charCodeAt(end - 1) === 9)) end -= 1;
  while (end > depth + 1 && line.charCodeAt(end - 1) === 35) end -= 1;
  while (end > depth + 1 && (line.charCodeAt(end - 1) === 32 || line.charCodeAt(end - 1) === 9)) end -= 1;
  const text = line.slice(depth + 1, end);
  if (!text) return null;
  return { depth, text };
}

function isSetext1(line: string): boolean {
  if (!line.startsWith("=")) return false;
  let i = 0;
  while (i < line.length && line[i] === "=") i += 1;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i += 1;
  return i === line.length;
}

function isSetext2(line: string): boolean {
  if (!line.startsWith("--")) return false;
  let i = 0;
  while (i < line.length && line[i] === "-") i += 1;
  if (i < 2) return false;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i += 1;
  return i === line.length;
}

function parseFrontmatter(source: string): { frontmatter: Record<string, unknown>; body: string } {
  const extracted = extractFrontmatter(source);
  return { frontmatter: yamlToPlain(extracted.yaml), body: extracted.body };
}

function headingText(raw: string): string {
  const s = raw.trim();
  if (!s.endsWith("}")) return s;
  const open = s.lastIndexOf("{");
  if (open < 0) return s;
  return s.slice(0, open).trim();
}

function extractHeadings(body: string): IndexedDocument["headings"] {
  const headings: IndexedDocument["headings"] = [];
  const lines = body.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (isFenceLine(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const atx = parseAtxHeading(line);
    if (atx) {
      const text = headingText(atx.text);
      if (text) headings.push({ text, slug: headingSlug(text), depth: atx.depth });
      continue;
    }
    const next = lines[i + 1] ?? "";
    const text = line.trim();
    if (!text) continue;
    if (isSetext1(next)) {
      headings.push({ text: headingText(text), slug: headingSlug(text), depth: 1 });
      i += 1;
    } else if (isSetext2(next)) {
      headings.push({ text: headingText(text), slug: headingSlug(text), depth: 2 });
      i += 1;
    }
  }
  return headings;
}

export function indexMarkdown(
  path: string,
  source: string,
  modifiedMs: number
): IndexedDocument {
  const { frontmatter, body } = parseFrontmatter(source);
  const headings = extractHeadings(body);
  const title =
    documentTitle(frontmatter, "") ||
    headings[0]?.text ||
    stripMdExtension(basename(path));
  const tags = Array.isArray(frontmatter.tags)
    ? (frontmatter.tags as unknown[]).map(String)
    : [];
  return {
    path,
    title,
    aliases: [stripMdExtension(basename(path)), title],
    headings,
    tags,
    wikilinks: extractWikiLinks(source).map(({ target, section, label }) => ({
      target,
      section,
      label
    })),
    plainText: body.replace(/[#>*`[\]()]/g, " "),
    modifiedMs
  };
}

export type SearchHitField = "title" | "path" | "tags" | "body";

export interface SearchHit {
  document: IndexedDocument;
  field: SearchHitField;
  excerpt: string;
}

export function excerptAround(text: string, query: string, radius = 42): string {
  const haystack = text.replace(/\s+/g, " ").trim();
  const needle = query.trim();
  if (!haystack) return "";
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return haystack.slice(0, radius * 2);
  const from = Math.max(0, index - radius);
  const to = Math.min(haystack.length, index + needle.length + radius);
  return `${from > 0 ? "…" : ""}${haystack.slice(from, to)}${to < haystack.length ? "…" : ""}`;
}

function hitFor(document: IndexedDocument, query: string): SearchHit | null {
  const q = query.toLowerCase();
  if (document.title.toLowerCase().includes(q)) {
    return { document, field: "title", excerpt: excerptAround(document.title, query) };
  }
  if (document.path.toLowerCase().includes(q)) {
    return { document, field: "path", excerpt: excerptAround(document.path, query) };
  }
  const tag = document.tags.find((item) => item.toLowerCase().includes(q));
  if (tag) {
    return { document, field: "tags", excerpt: excerptAround(tag, query) };
  }
  if (document.plainText.toLowerCase().includes(q)) {
    return { document, field: "body", excerpt: excerptAround(document.plainText, query) };
  }
  return null;
}

export function searchHits(index: WorkspaceIndex, query: string): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  return index.documents
    .map((document) => hitFor(document, q))
    .filter((hit): hit is SearchHit => hit != null);
}

export function searchIndex(index: WorkspaceIndex, query: string): IndexedDocument[] {
  return searchHits(index, query).map((hit) => hit.document);
}

export function backlinksTo(index: WorkspaceIndex, path: string): IndexedDocument[] {
  const names = new Set(
    [path, stripMdExtension(path), stripMdExtension(basename(path))].map((s) =>
      s.toLowerCase()
    )
  );
  return index.documents.filter((d) =>
    d.wikilinks.some((w) => names.has(w.target.toLowerCase()))
  );
}

export function resolveWikiTarget(
  index: WorkspaceIndex,
  _fromPath: string,
  target: string
): string | null {
  const t = target.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const withMd = t.endsWith(".md") ? t : `${t}.md`;
  const exact = index.documents.find(
    (d) =>
      d.path === t ||
      d.path === withMd ||
      stripMdExtension(d.path) === t ||
      d.path.replace(/\\/g, "/").toLowerCase() === lower ||
      d.path.replace(/\\/g, "/").toLowerCase().endsWith(`/${lower}`) ||
      d.path.replace(/\\/g, "/").toLowerCase().endsWith(`/${withMd.toLowerCase()}`)
  );
  if (exact) return exact.path;

  const ranked: { path: string; score: number }[] = [];
  for (const d of index.documents) {
    const base = stripMdExtension(basename(d.path)).toLowerCase();
    const title = d.title.toLowerCase();
    const aliases = d.aliases.map((a) => a.toLowerCase());
    if (base === lower) ranked.push({ path: d.path, score: 3 });
    else if (title === lower) ranked.push({ path: d.path, score: 2 });
    else if (aliases.includes(lower)) ranked.push({ path: d.path, score: 1 });
  }
  ranked.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return ranked[0]?.path ?? null;
}

export function brokenLinks(index: WorkspaceIndex): { from: string; target: string }[] {
  const out: { from: string; target: string }[] = [];
  for (const doc of index.documents) {
    for (const link of doc.wikilinks) {
      if (!resolveWikiTarget(index, doc.path, link.target)) {
        out.push({ from: doc.path, target: link.target });
      }
    }
  }
  return out;
}
