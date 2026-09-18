import type { GenericNode } from "./constants";

export type NumberedKind = "figure" | "table" | "math" | "heading";

export interface NumberedTarget {
  label: string;
  kind: NumberedKind;
  number: string;
  title?: string;
}

export interface NumberingIndex {
  byLabel: Map<string, NumberedTarget>;
  figures: NumberedTarget[];
  tables: NumberedTarget[];
  equations: NumberedTarget[];
  headings: NumberedTarget[];
}

function isEnumerated(node: GenericNode, defaultValue = true): boolean {
  if (node.enumerated === false) return false;
  return defaultValue;
}

function headingText(node: GenericNode): string {
  return (node.children ?? [])
    .flatMap((child) => {
      if (child.type === "text") return [String(child.value ?? "")];
      return (child.children ?? []).flatMap((c) => (c.type === "text" ? [String(c.value ?? "")] : []));
    })
    .join("")
    .trim();
}

function captionText(node: GenericNode): string {
  const cap = (node.children ?? []).find((c) => c.type === "caption");
  if (!cap) return "";
  return (cap.children ?? [])
    .flatMap((c) => (c.type === "paragraph" ? c.children ?? [] : [c]))
    .flatMap((c) => (c.type === "text" ? [String(c.value ?? "")] : []))
    .join("")
    .trim();
}

export function buildNumberingIndex(ast: GenericNode): NumberingIndex {
  const index: NumberingIndex = {
    byLabel: new Map(),
    figures: [],
    tables: [],
    equations: [],
    headings: []
  };

  let figureN = 0;
  let tableN = 0;
  let eqN = 0;
  const headingCounts = [0, 0, 0, 0, 0, 0];

  const walk = (node: GenericNode) => {
    if (node.type === "heading") {
      const depth = Math.min(6, Math.max(1, Number(node.depth ?? 1)));
      if (isEnumerated(node)) {
        headingCounts[depth - 1] += 1;
        for (let i = depth; i < 6; i++) headingCounts[i] = 0;
        const parts = headingCounts.slice(0, depth).filter((n) => n > 0);
        const number = parts.join(".");
        const label = String(node.label ?? node.identifier ?? "").trim();
        const target: NumberedTarget = {
          label,
          kind: "heading",
          number,
          title: headingText(node)
        };
        index.headings.push(target);
        if (label) index.byLabel.set(label, target);
      }
    }

    if (node.type === "container" && node.kind === "figure" && isEnumerated(node)) {
      figureN += 1;
      const label = String(node.label ?? node.identifier ?? "").trim();
      const target: NumberedTarget = {
        label,
        kind: "figure",
        number: String(figureN),
        title: captionText(node)
      };
      index.figures.push(target);
      if (label) index.byLabel.set(label, target);
    }

    if (node.type === "table") {
      const meta = (node.data as { mdwordTable?: { label?: string; caption?: string; enumerated?: boolean } })?.mdwordTable;
      const label = String(meta?.label ?? node.label ?? node.identifier ?? "").trim();
      const enumerated = meta?.enumerated !== false;
      if (enumerated) {
        tableN += 1;
        const target: NumberedTarget = {
          label,
          kind: "table",
          number: String(tableN),
          title: meta?.caption ?? captionText(node)
        };
        index.tables.push(target);
        if (label) index.byLabel.set(label, target);
      }
    }

    if (node.type === "math" && isEnumerated(node)) {
      eqN += 1;
      const label = String(node.label ?? node.identifier ?? "").trim();
      const target: NumberedTarget = {
        label,
        kind: "math",
        number: String(eqN)
      };
      index.equations.push(target);
      if (label) index.byLabel.set(label, target);
    }

    if (node.type === "mystDirective") {
      const name = String(node.name ?? "");
      if (name === "figure" || name === "image") {
        const inner = (node.children ?? []).find((c) => c.type === "container" && c.kind === "figure");
        if (inner) walk(inner);
      }
      if (name === "table" || name === "list-table" || name === "csv-table") {
        const inner = (node.children ?? []).find((c) => c.type === "container" && c.kind === "table");
        const table = inner?.children?.find((c) => c.type === "table");
        if (table) walk(table);
      }
    }

    (node.children ?? []).forEach(walk);
  };

  walk(ast);
  return index;
}

export function resolveCrossReference(label: string, index: NumberingIndex): NumberedTarget | undefined {
  return index.byLabel.get(label);
}

export function formatReferenceDisplay(target: NumberedTarget | undefined, kind?: string): string {
  if (!target) return "?";
  if (kind === "eq" || target.kind === "math") return `(${target.number})`;
  if (kind === "numref") {
    if (target.kind === "figure") return `Figure ${target.number}`;
    if (target.kind === "table") return `Table ${target.number}`;
    if (target.kind === "heading") return `Section ${target.number}`;
  }
  if (target.kind === "figure") return `Figure ${target.number}`;
  if (target.kind === "table") return `Table ${target.number}`;
  if (target.kind === "heading") return target.number;
  return target.number;
}
