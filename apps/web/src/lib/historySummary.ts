import {
  countLineChanges,
  diffLines,
  documentTitle,
  foldEmbeddedDataUrls,
  imageNodeUrl,
  imageRefId,
  isEmbeddedImageUrl,
  isImageLike,
  type GenericNode
} from "@mdword/shared";
import { parseMarkdown } from "@mdword/myst-parser";
import { frontmatterLabel } from "@mdword/document-model";

const TITLE_KEYS = new Set(["title", "titolo", "name", "nome"]);
const PREVIEW_MAX = 72;

export type HistorySummary = {
  facts: string[];
  added: number;
  removed: number;
};

type ImageShot = { key: string; embedded: boolean };
type TableShot = { rows: number; fingerprint: string };
type DocShot = {
  title: string;
  firstHeading: string;
  frontmatter: Record<string, unknown>;
  mdoc: Record<string, unknown>;
  images: ImageShot[];
  tables: TableShot[];
  paragraphs: string[];
  headings: string[];
};

const MDOC_LABELS: Record<string, string> = {
  margins: "margins",
  page: "page size",
  fontScale: "font",
  typography: "font",
  header: "header",
  footer: "footer",
  toc: "table of contents",
  numbering: "numbering",
  template: "template"
};

function textOf(node: GenericNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function preview(text: string): string {
  const folded = foldEmbeddedDataUrls(text).replace(/\s+/g, " ").replace(/data:image\/\S+/gi, "").trim();
  if (!folded) return "";
  return folded.length > PREVIEW_MAX ? `${folded.slice(0, PREVIEW_MAX)}…` : folded;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function inspect(source: string): DocShot {
  const parsed = parseMarkdown(source);
  const images: ImageShot[] = [];
  const tables: TableShot[] = [];
  const paragraphs: string[] = [];
  const headings: string[] = [];

  const walk = (node: GenericNode) => {
    if (isImageLike(node)) {
      const url = imageNodeUrl(node);
      if (url) {
        const embedded = isEmbeddedImageUrl(url);
        images.push({ key: embedded ? imageRefId(url) : url.trim(), embedded });
      }
      return;
    }
    if (node.type === "table") {
      tables.push({
        rows: node.children?.length ?? 0,
        fingerprint: preview(textOf(node))
      });
      return;
    }
    if (node.type === "heading") {
      const text = preview(textOf(node));
      if (text) headings.push(text);
      return;
    }
    if (node.type === "paragraph") {
      const kids = node.children ?? [];
      const onlyImage = kids.length === 1 && isImageLike(kids[0]);
      if (!onlyImage) {
        const text = preview(textOf(node));
        if (text) paragraphs.push(text);
      }
    }
    node.children?.forEach(walk);
  };
  walk(parsed.ast);

  const title = documentTitle(parsed.frontmatter, "");
  return {
    title,
    firstHeading: headings[0] ?? "",
    frontmatter: parsed.frontmatter,
    mdoc: (parsed.mdoc ?? {}) as Record<string, unknown>,
    images,
    tables,
    paragraphs,
    headings
  };
}

function noun(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function countAligned(before: string[], after: string[]): { added: number; removed: number; changed: number } {
  if (!before.length && !after.length) return { added: 0, removed: 0, changed: 0 };
  if (!before.length) return { added: after.length, removed: 0, changed: 0 };
  if (!after.length) return { added: 0, removed: before.length, changed: 0 };
  const { added, removed } = countLineChanges(diffLines(before.join("\n"), after.join("\n")));
  const changed = Math.min(added, removed);
  return { added: added - changed, removed: removed - changed, changed };
}

function imageFacts(before: ImageShot[], after: ImageShot[]): string[] {
  const beforeFiles = before.filter((item) => !item.embedded);
  const afterFiles = after.filter((item) => !item.embedded);
  const beforeEmbeds = before.filter((item) => item.embedded);
  const afterEmbeds = after.filter((item) => item.embedded);
  const fileDelta = afterFiles.length - beforeFiles.length;
  const embedDelta = afterEmbeds.length - beforeEmbeds.length;
  const imported = Math.min(Math.max(0, -fileDelta), Math.max(0, embedDelta));
  const addedEmbeds = Math.max(0, embedDelta - imported);
  const removedEmbeds = Math.max(0, -embedDelta);
  const addedFiles = Math.max(0, fileDelta);
  const removedFiles = Math.max(0, -fileDelta - imported);

  const beforeEmbedKeys = new Set(beforeEmbeds.map((item) => item.key));
  const afterEmbedKeys = new Set(afterEmbeds.map((item) => item.key));
  let updated = 0;
  if (!imported && !addedEmbeds && !removedEmbeds && beforeEmbeds.length && afterEmbeds.length) {
    for (const key of afterEmbedKeys) {
      if (!beforeEmbedKeys.has(key)) updated += 1;
    }
  }

  const facts: string[] = [];
  if (imported) {
    facts.push(
      `${imported} ${noun(imported, "image", "images")} imported (payload hidden)`
    );
  }
  if (addedEmbeds) {
    facts.push(`${addedEmbeds} ${noun(addedEmbeds, "image", "images")} added (payload hidden)`);
  }
  if (updated) {
    facts.push(`${updated} ${noun(updated, "image", "images")} updated (payload hidden)`);
  }
  if (removedEmbeds) {
    facts.push(`${removedEmbeds} ${noun(removedEmbeds, "image", "images")} removed`);
  }
  if (addedFiles) facts.push(`${addedFiles} ${noun(addedFiles, "linked image", "linked images")} added`);
  if (removedFiles) facts.push(`${removedFiles} ${noun(removedFiles, "linked image", "linked images")} removed`);
  return facts;
}

function tableFacts(before: TableShot[], after: TableShot[]): string[] {
  const facts: string[] = [];
  const n = Math.max(before.length, after.length);
  let added = 0;
  let removed = 0;
  for (let i = 0; i < n; i += 1) {
    const prev = before[i];
    const next = after[i];
    if (!prev && next) {
      added += 1;
      continue;
    }
    if (prev && !next) {
      removed += 1;
      continue;
    }
    if (!prev || !next) continue;
    const delta = next.rows - prev.rows;
    if (delta > 0) {
      facts.push(`Table ${i + 1}: ${delta} ${noun(delta, "row", "rows")} added`);
    } else if (delta < 0) {
      facts.push(`Table ${i + 1}: ${-delta} ${noun(-delta, "row", "rows")} removed`);
    } else if (prev.fingerprint !== next.fingerprint) {
      facts.push(`Table ${i + 1} changed`);
    }
  }
  if (added) facts.unshift(`${added} ${noun(added, "table", "tables")} added`);
  if (removed) facts.unshift(`${removed} ${noun(removed, "table", "tables")} removed`);
  return facts;
}

function paragraphFacts(before: string[], after: string[]): string[] {
  const { added, removed, changed } = countAligned(before, after);
  const facts: string[] = [];
  if (changed) {
    facts.push(
      changed === 1 && after.find((p) => !before.includes(p))
        ? `1 paragraph changed: ${after.find((p) => !before.includes(p))}`
        : `${changed} ${noun(changed, "paragraph", "paragraphs")} changed`
    );
  }
  if (added) {
    const extra = after.filter((p) => !before.includes(p));
    facts.push(
      added === 1 && extra[0]
        ? `1 paragraph added: ${extra[0]}`
        : `${added} ${noun(added, "paragraph", "paragraphs")} added`
    );
  }
  if (removed) {
    facts.push(`${removed} ${noun(removed, "paragraph", "paragraphs")} removed`);
  }
  return facts;
}

function headingFacts(before: string[], after: string[], titleChanged: boolean, beforeTitle: string, afterTitle: string): string[] {
  const skip = new Set([beforeTitle, afterTitle].filter(Boolean));
  const prev = before.filter((h) => !skip.has(h) || !titleChanged);
  const next = after.filter((h) => !skip.has(h) || !titleChanged);
  if (titleChanged && before[0] === beforeTitle && after[0] === afterTitle) {
    const rest = countAligned(before.slice(1), after.slice(1));
    if (rest.changed) return [`${rest.changed} ${noun(rest.changed, "heading", "headings")} changed`];
    if (rest.added) return [`${rest.added} ${noun(rest.added, "heading", "headings")} added`];
    if (rest.removed) return [`${rest.removed} ${noun(rest.removed, "heading", "headings")} removed`];
    return [];
  }
  const { added, removed, changed } = countAligned(prev, next);
  const facts: string[] = [];
  if (changed === 1) {
    const from = prev.find((h) => !next.includes(h));
    const to = next.find((h) => !prev.includes(h));
    if (from && to) facts.push(`Heading: ${from} → ${to}`);
    else facts.push(to ? `1 heading changed: ${to}` : "1 heading changed");
  } else if (changed) {
    facts.push(`${changed} headings changed`);
  }
  if (added) {
    const extra = next.find((h) => !prev.includes(h));
    facts.push(added === 1 && extra ? `1 heading added: ${extra}` : `${added} headings added`);
  }
  if (removed) facts.push(`${removed} ${noun(removed, "heading", "headings")} removed`);
  return facts;
}

function mdocFacts(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const parts: string[] = [];
  for (const key of keys) {
    if (key === "version") continue;
    if (sameJson(before[key], after[key])) continue;
    const label = MDOC_LABELS[key] ?? key;
    if (!parts.includes(label)) parts.push(label);
  }
  return parts.length ? [`Page properties: ${parts.join(", ")}`] : [];
}

function propertyFacts(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const parts: string[] = [];
  for (const key of keys) {
    if (TITLE_KEYS.has(key) || key === "mdoc") continue;
    if (sameJson(before[key], after[key])) continue;
    parts.push(frontmatterLabel(key));
  }
  return parts.length ? [`Document properties: ${parts.join(", ")}`] : [];
}

/** Structured changelog. Never includes base64 image payloads. */
export function summarizeHistoryChanges(before: string, after: string): HistorySummary {
  const foldedBefore = foldEmbeddedDataUrls(before);
  const foldedAfter = foldEmbeddedDataUrls(after);
  const counts = countLineChanges(diffLines(foldedBefore, foldedAfter));
  if (before === after) return { facts: [], added: 0, removed: 0 };

  try {
    const prev = inspect(before);
    const next = inspect(after);
    const displayTitle = (shot: DocShot) => shot.title || shot.firstHeading || "Untitled";
    const titleChanged = displayTitle(prev) !== displayTitle(next);
    const facts = [
      ...(titleChanged ? [`Title: ${displayTitle(prev)} → ${displayTitle(next)}`] : []),
      ...mdocFacts(prev.mdoc, next.mdoc),
      ...propertyFacts(prev.frontmatter, next.frontmatter),
      ...imageFacts(prev.images, next.images),
      ...tableFacts(prev.tables, next.tables),
      ...headingFacts(prev.headings, next.headings, titleChanged, displayTitle(prev), displayTitle(next)),
      ...paragraphFacts(prev.paragraphs, next.paragraphs)
    ];
    const unique = facts.filter((fact, i) => facts.indexOf(fact) === i);
    if (!unique.length && (counts.added || counts.removed)) unique.push("Document text changed");
    return { facts: unique, added: counts.added, removed: counts.removed };
  } catch {
    return {
      facts: counts.added || counts.removed ? ["Document text changed"] : [],
      added: counts.added,
      removed: counts.removed
    };
  }
}

export function safeHistoryDiffLine(text: string): string {
  const folded = foldEmbeddedDataUrls(text);
  if (/data:image\//i.test(folded)) return "[image payload hidden]";
  return folded.length > 160 ? `${folded.slice(0, 160)}…` : folded;
}
