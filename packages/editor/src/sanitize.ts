import type { TiptapNode } from "./astToTiptap";

const EMPTY_PARAGRAPH: TiptapNode = { type: "paragraph" };

function isNonEmptyText(node: TiptapNode): boolean {
  return node.type !== "text" || Boolean(node.text);
}

function sanitizeInline(nodes: TiptapNode[] | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    const next = sanitizeNode(node);
    if (!next) continue;
    if (next.type === "text" && !next.text) continue;
    out.push(next);
  }
  return out;
}

function sanitizeBlocks(nodes: TiptapNode[] | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const node of nodes ?? []) {
    const next = sanitizeNode(node);
    if (next) out.push(next);
  }
  return out.length ? out : [EMPTY_PARAGRAPH];
}

function padRow(row: TiptapNode, width: number): TiptapNode {
  const cells = [...(row.content ?? [])];
  while (cells.length < width) {
    cells.push({ type: "tableCell", content: [EMPTY_PARAGRAPH] });
  }
  return { ...row, content: cells };
}

function sanitizeNode(node: TiptapNode): TiptapNode | null {
  if (node.type === "text") {
    return node.text ? node : null;
  }

  if (node.type === "wikiLink") {
    const target = String(node.attrs?.target ?? "").replace(/\\$/, "").trim();
    const label = String(node.attrs?.label ?? "").trim() || target;
    if (!target && !label) return null;
    return {
      ...node,
      attrs: { ...node.attrs, target: target || label, label: label || target }
    };
  }

  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "").trim();
    if (!src) return null;
    return node;
  }

  const content = (node.content ?? [])
    .map((child) => sanitizeNode(child))
    .filter((child): child is TiptapNode => child != null)
    .filter(isNonEmptyText);

  if (node.type === "paragraph" || node.type === "heading" || node.type === "caption") {
    return { ...node, content };
  }

  if (node.type === "tableCell" || node.type === "tableHeader") {
    const blocks = content.length ? content : [EMPTY_PARAGRAPH];
    return { ...node, content: blocks };
  }

  if (node.type === "tableRow") {
    if (!content.length) return null;
    return { ...node, content };
  }

  if (node.type === "table") {
    const rows = content.filter((row) => row.type === "tableRow" && (row.content?.length ?? 0) > 0);
    if (!rows.length) return EMPTY_PARAGRAPH;
    const width = Math.max(...rows.map((row) => row.content?.length ?? 0), 1);
    return { ...node, content: rows.map((row) => padRow(row, width)) };
  }

  if (node.type === "listItem" || node.type === "taskItem") {
    return { ...node, content: content.length ? content : [EMPTY_PARAGRAPH] };
  }

  if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
    if (!content.length) return EMPTY_PARAGRAPH;
    return { ...node, content };
  }

  if (node.type === "blockquote" || node.type === "callout") {
    return { ...node, content: content.length ? content : [EMPTY_PARAGRAPH] };
  }

  if (node.type === "figure") {
    if (!content.some((child) => child.type === "image")) {
      return content.length ? { type: "paragraph", content: sanitizeInline(content) } : EMPTY_PARAGRAPH;
    }
    return { ...node, content };
  }

  if (node.type === "doc") {
    return { ...node, content: content.length ? content : [EMPTY_PARAGRAPH] };
  }

  return content.length ? { ...node, content } : { ...node, content: undefined };
}

export function sanitizeTiptapDoc(doc: TiptapNode): TiptapNode {
  const cleaned = sanitizeNode({ ...doc, type: "doc" });
  return cleaned ?? { type: "doc", content: [EMPTY_PARAGRAPH] };
}
