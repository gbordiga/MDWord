import type { GenericNode } from "./constants";

export type TableSourceKind = "gfm" | "table" | "list-table" | "csv-table";
export type TableAlign = "left" | "center" | "right";
export type CellAlign = TableAlign;

export interface TableMeta {
  align?: TableAlign | null;
  widths?: "auto" | number[] | null;
  width?: string | null;
  caption?: string | null;
  label?: string | null;
  headerRows?: number;
  sourceKind?: TableSourceKind;
}

const TABLE_META_KEY = "mdwordTable";

export function getTableMeta(node: GenericNode): TableMeta {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const stored = data[TABLE_META_KEY];
  if (stored && typeof stored === "object") return stored as TableMeta;
  return {};
}

export function withTableMeta(node: GenericNode, meta: TableMeta): GenericNode {
  return {
    ...node,
    data: { ...(node.data ?? {}), [TABLE_META_KEY]: meta }
  };
}

export function parseWidthsOption(raw: unknown): TableMeta["widths"] {
  if (raw == null || raw === "") return null;
  const text = String(raw).trim().toLowerCase();
  if (text === "auto" || text === "grid") return "auto";
  const nums = text
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? nums : null;
}

export function formatWidthsOption(widths: TableMeta["widths"]): string | undefined {
  if (!widths) return undefined;
  if (widths === "auto") return "auto";
  return widths.join(" ");
}

export function tableMetaFromDirective(
  name: string,
  options: Record<string, unknown> = {},
  args?: unknown,
  container?: GenericNode
): TableMeta {
  const captionNode = container?.children?.find((c) => c.type === "caption");
  const captionText = captionNode
    ? (captionNode.children ?? [])
        .flatMap(collectText)
        .join("")
        .trim()
    : String(args ?? "").trim() || null;

  return {
    align: (options.align as TableAlign) ?? null,
    widths: parseWidthsOption(options.widths),
    width: options.width != null ? String(options.width) : null,
    caption: captionText,
    label: (options.label as string) ?? (container?.label as string) ?? null,
    headerRows: options["header-rows"] != null ? Number(options["header-rows"]) : 1,
    sourceKind: name as TableSourceKind
  };
}

function collectText(node: GenericNode): string[] {
  if (node.type === "text" && node.value) return [String(node.value)];
  return (node.children ?? []).flatMap(collectText);
}

export function tableMetaNeedsDirective(meta: TableMeta, table: GenericNode): boolean {
  if (meta.sourceKind && meta.sourceKind !== "gfm") return true;
  if (meta.caption) return true;
  if (meta.label) return true;
  if (meta.width) return true;
  if (meta.align) return true;
  if (meta.widths && meta.widths !== "auto") return true;
  if ((meta.headerRows ?? 1) !== 1) return true;
  return hasNonDefaultCellAlign(table);
}

function hasNonDefaultCellAlign(table: GenericNode): boolean {
  for (const row of table.children ?? []) {
    for (const cell of row.children ?? []) {
      if (cell.align && cell.align !== "left") return true;
    }
  }
  return false;
}

function cellText(cell: GenericNode): string {
  return (cell.children ?? []).flatMap(collectText).join("").trim();
}

function gfmDelimiter(cells: GenericNode[]): string {
  return cells
    .map((cell) => {
      const align = String(cell.align ?? "left") as CellAlign;
      if (align === "center") return ":---:";
      if (align === "right") return "---:";
      return "---";
    })
    .join(" | ");
}

function gfmRow(cells: GenericNode[]): string {
  return `| ${cells.map((cell) => cellText(cell).replace(/\|/g, "\\|")).join(" | ")} |`;
}

export function tableToGfm(table: GenericNode): string {
  const rows = table.children ?? [];
  if (!rows.length) return "| | |\n| --- | --- |";
  const lines: string[] = [];
  rows.forEach((row, index) => {
    const cells = row.children ?? [];
    lines.push(gfmRow(cells));
    if (index === 0) lines.push(`| ${gfmDelimiter(cells)} |`);
  });
  return lines.join("\n");
}

function listTableBody(table: GenericNode): string {
  const rows = table.children ?? [];
  return rows
    .map((row) => {
      const cells = row.children ?? [];
      const first = cellText(cells[0] ?? {});
      const rest = cells.slice(1).map((c) => `  - ${cellText(c)}`);
      return [`* - ${first}`, ...rest].join("\n");
    })
    .join("\n");
}

export function serializeTableMarkdown(table: GenericNode, meta: TableMeta): string {
  const kind = meta.sourceKind ?? "gfm";
  if (!tableMetaNeedsDirective(meta, table) && kind === "gfm") {
    return tableToGfm(table);
  }

  const directive = kind === "gfm" ? "table" : kind;
  const lines: string[] = [`:::{${directive}}${meta.caption ? ` ${meta.caption}` : ""}`];
  if (meta.width) lines.push(`:width: ${meta.width}`);
  if (meta.align) lines.push(`:align: ${meta.align}`);
  const widths = formatWidthsOption(meta.widths);
  if (widths) lines.push(`:widths: ${widths}`);
  if ((meta.headerRows ?? 1) !== 1) lines.push(`:header-rows: ${meta.headerRows}`);
  if (meta.label) lines.push(`:label: ${meta.label}`);
  lines.push("");

  if (directive === "list-table") {
    lines.push(listTableBody(table));
  } else {
    lines.push(tableToGfm(table));
  }
  lines.push(":::");
  return lines.join("\n");
}

export function extractTableFromDirective(node: GenericNode): {
  table: GenericNode | null;
  meta: TableMeta;
} {
  const name = String(node.name ?? "table");
  const container = node.children?.find((c) => c.type === "container" && c.kind === "table");
  const table = container?.children?.find((c) => c.type === "table") ?? node.children?.find((c) => c.type === "table");
  const meta = tableMetaFromDirective(name, (node.options ?? {}) as Record<string, unknown>, node.args, container);
  return { table: table ?? null, meta };
}

export const TABLE_PLACEHOLDER_PREFIX = "<!--MDWORD_TABLE_";

export function tablePlaceholder(index: number): string {
  return `${TABLE_PLACEHOLDER_PREFIX}${index}-->`;
}

export function substituteRichTables(root: GenericNode): { ast: GenericNode; snippets: string[] } {
  const snippets: string[] = [];
  const walk = (node: GenericNode): GenericNode => {
    if (node.type === "table") {
      const meta = getTableMeta(node);
      if (tableMetaNeedsDirective(meta, node)) {
        const index = snippets.length;
        snippets.push(serializeTableMarkdown(node, meta));
        return { type: "html", value: tablePlaceholder(index) };
      }
      return node;
    }
    if (!node.children) return node;
    return { ...node, children: node.children.map(walk) };
  };
  return { ast: walk(root), snippets };
}

export function restoreTablePlaceholders(md: string, snippets: string[]): string {
  let out = md;
  snippets.forEach((snippet, index) => {
    out = out.replace(tablePlaceholder(index), `\n${snippet}\n`);
  });
  return out;
}
