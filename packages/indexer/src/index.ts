import { extractWikiLinks, headingSlug, stripMdExtension, basename } from "@mdword/shared";
import { parseMarkdown } from "@mdword/myst-parser";

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

function textOf(node: { type: string; value?: string; children?: unknown[] }): string {
  if (typeof node.value === "string") return node.value;
  if (Array.isArray(node.children)) {
    return (node.children as typeof node[]).map(textOf).join("");
  }
  return "";
}

export function indexMarkdown(
  path: string,
  source: string,
  modifiedMs: number
): IndexedDocument {
  const parsed = parseMarkdown(source);
  const headings: IndexedDocument["headings"] = [];
  const walk = (node: { type: string; depth?: number; children?: unknown[]; value?: string }) => {
    if (node.type === "heading") {
      const text = textOf(node);
      headings.push({
        text,
        slug: headingSlug(text),
        depth: Number(node.depth ?? 1)
      });
    }
    node.children?.forEach((c) => walk(c as typeof node));
  };
  walk(parsed.ast as never);
  const title =
    (typeof parsed.frontmatter.title === "string" && parsed.frontmatter.title) ||
    headings[0]?.text ||
    stripMdExtension(basename(path));
  const tags = Array.isArray(parsed.frontmatter.tags)
    ? (parsed.frontmatter.tags as unknown[]).map(String)
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
    plainText: source.replace(/---[\s\S]*?---/, "").replace(/[#>*`[\]()]/g, " "),
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
  fromPath: string,
  target: string
): string | null {
  const withMd = target.endsWith(".md") ? target : `${target}.md`;
  const exact = index.documents.find(
    (d) => d.path === withMd || d.path === target || stripMdExtension(d.path) === target
  );
  if (exact) return exact.path;
  const base = target.split("/").pop() ?? target;
  const matches = index.documents.filter(
    (d) => stripMdExtension(basename(d.path)).toLowerCase() === base.toLowerCase()
  );
  return matches.length === 1 ? matches[0]!.path : null;
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
