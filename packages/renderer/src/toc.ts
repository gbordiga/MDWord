import type { GenericNode } from "@mdword/shared";

export interface TocItem {
  depth: number;
  text: string;
  number: string;
}

function nodeText(node: GenericNode): string {
  if (typeof node.value === "string" && !node.children?.length) return node.value;
  return (node.children ?? []).map(nodeText).join("");
}

export function collectTocItems(ast: GenericNode, maxDepth = 3): TocItem[] {
  const items: TocItem[] = [];
  const counters = [0, 0, 0, 0, 0, 0];
  const walk = (node: GenericNode) => {
    if (node.type === "heading") {
      const depth = Math.min(6, Math.max(1, Number(node.depth ?? 1)));
      if (depth <= maxDepth) {
        for (let i = depth; i < counters.length; i++) counters[i] = 0;
        counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
        const text = nodeText(node).trim();
        if (text) {
          items.push({
            depth,
            text,
            number: counters.slice(0, depth).join(".")
          });
        }
      }
    }
    node.children?.forEach(walk);
  };
  walk(ast);
  return items;
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTocHtml(items: TocItem[], numbered: boolean): string {
  const heading = "<h2>Contents</h2>";
  if (!items.length) {
    return `<nav class="toc" data-toc="true">${heading}<p class="toc-empty">No headings in this document yet.</p></nav>`;
  }
  const lis = items
    .map((item) => {
      const label = numbered ? `${item.number} ${escape(item.text)}` : escape(item.text);
      return `<li class="toc-d${item.depth}">${label}</li>`;
    })
    .join("");
  return `<nav class="toc" data-toc="true">${heading}<ol>${lis}</ol></nav>`;
}
