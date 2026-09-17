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

const FENCE = /^(?:`{3,}|~{3,})/;
const ATX = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const SETEXT_1 = /^=+[ \t]*$/;
const SETEXT_2 = /^-{2,}[ \t]*$/;

function parseFrontmatter(source: string): { frontmatter: Record<string, unknown>; body: string } {
  const extracted = extractFrontmatter(source);
  return { frontmatter: yamlToPlain(extracted.yaml), body: extracted.body };
}

function headingText(raw: string): string {
  return raw.replace(/\s*\{[^}]*\}\s*$/, "").trim();
}

function extractHeadings(body: string): IndexedDocument["headings"] {
  const headings: IndexedDocument["headings"] = [];
  const lines = body.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const atx = ATX.exec(line);
    if (atx) {
      const text = headingText(atx[2] ?? "");
      if (text) {
        headings.push({ text, slug: headingSlug(text), depth: atx[1]?.length ?? 1 });
      }
      continue;
    }
    const next = lines[i + 1] ?? "";
    const text = line.trim();
    if (!text) continue;
    if (SETEXT_1.test(next)) {
      headings.push({ text: headingText(text), slug: headingSlug(text), depth: 1 });
      i += 1;
    } else if (SETEXT_2.test(next)) {
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

export function searchIndex(
  index: WorkspaceIndex,
  query: string
): IndexedDocument[] {
  const q = query.trim().toLowerCase();
  if (!q) return index.documents;
  return index.documents.filter((d) => {
    return (
      d.title.toLowerCase().includes(q) ||
      d.path.toLowerCase().includes(q) ||
      d.tags.some((t) => t.toLowerCase().includes(q)) ||
      d.plainText.toLowerCase().includes(q)
    );
  });
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
