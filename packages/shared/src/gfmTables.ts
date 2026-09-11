import type { GenericNode } from "./constants";

const DELIM_ROW = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/;

function tokenizePipes(value: string): Array<GenericNode | "|"> {
  const out: Array<GenericNode | "|"> = [];
  let current = "";
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "\\" && value[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (value[i] === "|") {
      if (current) out.push({ type: "text", value: current });
      current = "";
      out.push("|");
      continue;
    }
    current += value[i];
  }
  if (current) out.push({ type: "text", value: current });
  return out;
}

function splitTableCells(line: string): string[] {
  const tokens = tokenizePipes(line);
  const cells: string[] = [""];
  for (const token of tokens) {
    if (token === "|") {
      cells.push("");
      continue;
    }
    cells[cells.length - 1] += String(token.value ?? "");
  }
  const trimmed = line.trim();
  if (trimmed.startsWith("|") || trimmed.startsWith("\\|")) cells.shift();
  if ((trimmed.endsWith("|") || trimmed.endsWith("\\|")) && cells.length) cells.pop();
  return cells;
}

function isDelimLine(line: string): boolean {
  return DELIM_ROW.test(line.replace(/\\\|/g, "|"));
}

function padCells(cells: string[], cols: number, fill: string): string[] {
  const next = cells.map((cell) => cell.trim());
  while (next.length < cols) next.push(fill);
  return next.slice(0, cols);
}

function formatRow(cells: string[]): string {
  return `| ${cells.map((cell) => cell || "").join(" | ")} |`;
}

function isFenceOpen(line: string): string | null {
  const trim = line.trimStart();
  if (trim.startsWith("```")) return "```";
  if (trim.startsWith("~~~")) return "~~~";
  if (trim.startsWith(":::")) return ":::";
  return null;
}

/**
 * GFM requires the header and delimiter to have the same cell count.
 * A photo row with one extra `|` otherwise becomes a paragraph and myst-to-md
 * escapes the following rows as `\\|`.
 */
export function normalizeGfmTables(md: string): string {
  const lines = md.split("\n");
  const out = [...lines];
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    const opened = isFenceOpen(line);
    if (opened) {
      fence = opened;
      continue;
    }
    if (i === 0 || !isDelimLine(line)) continue;
    const header = lines[i - 1] ?? "";
    if (!header.includes("|")) continue;
    const cols = Math.max(splitTableCells(header).length, splitTableCells(line).length);
    if (cols < 2) continue;
    if (splitTableCells(header).length !== cols) {
      out[i - 1] = formatRow(padCells(splitTableCells(header), cols, ""));
    }
    if (splitTableCells(line).length !== cols) {
      out[i] = formatRow(padCells(splitTableCells(line), cols, "---"));
    }
    for (let j = i + 1; j < lines.length; j += 1) {
      const body = lines[j] ?? "";
      if (!body.includes("|") || isDelimLine(body) || isFenceOpen(body)) break;
      if (splitTableCells(body).length === cols) continue;
      out[j] = formatRow(padCells(splitTableCells(body), cols, ""));
    }
  }
  return out.join("\n");
}

function isEmptyNodes(nodes: GenericNode[]): boolean {
  return !nodes.length || nodes.every((node) => node.type === "text" && !String(node.value ?? "").trim());
}

function trimCell(nodes: GenericNode[]): GenericNode[] {
  const next = nodes.filter((node) => node.type !== "text" || String(node.value ?? "") !== "");
  if (next[0]?.type === "text") next[0] = { ...next[0], value: String(next[0].value ?? "").trimStart() };
  const last = next.at(-1);
  if (last?.type === "text") {
    next[next.length - 1] = { ...last, value: String(last.value ?? "").trimEnd() };
  }
  return next.filter((node) => node.type !== "text" || String(node.value ?? ""));
}

function splitRowParts(parts: GenericNode[]): GenericNode[][] {
  const tokens: Array<GenericNode | "|"> = [];
  for (const part of parts) {
    if (part.type === "text") tokens.push(...tokenizePipes(String(part.value ?? "")));
    else tokens.push(part);
  }
  if (tokens[0] === "|") tokens.shift();
  if (tokens.at(-1) === "|") tokens.pop();
  const cells: GenericNode[][] = [[]];
  for (const token of tokens) {
    if (token === "|") {
      cells.push([]);
      continue;
    }
    cells[cells.length - 1]?.push(token);
  }
  if (cells.length && isEmptyNodes(cells[0] ?? [])) cells.shift();
  if (cells.length && isEmptyNodes(cells.at(-1) ?? [])) cells.pop();
  return cells;
}

function isDelimParts(parts: GenericNode[]): boolean {
  if (parts.some((part) => part.type !== "text")) return false;
  return isDelimLine(parts.map((part) => String(part.value ?? "")).join(""));
}

function rowsFromParagraph(node: GenericNode): GenericNode[][] | null {
  const rows: GenericNode[][] = [[]];
  for (const child of node.children ?? []) {
    if (child.type === "text" && String(child.value ?? "").includes("\n")) {
      const bits = String(child.value ?? "").split("\n");
      bits.forEach((bit, index) => {
        if (index > 0) rows.push([]);
        if (bit) rows[rows.length - 1]?.push({ type: "text", value: bit });
      });
      continue;
    }
    rows[rows.length - 1]?.push(child);
  }
  const delim = rows.findIndex(isDelimParts);
  if (delim < 1) return null;
  return [rows[0] ?? [], ...rows.slice(delim + 1)];
}

function tableFromRows(rows: GenericNode[][]): GenericNode | null {
  const headerCells = splitRowParts(rows[0] ?? []);
  if (headerCells.length < 2) return null;
  const width = headerCells.length;
  const body = rows.slice(1).map((row) => {
    const cells = splitRowParts(row);
    while (cells.length < width) cells.push([]);
    return cells.slice(0, width);
  });
  const asRow = (cells: GenericNode[][]): GenericNode => ({
    type: "tableRow",
    children: cells.map((cell) => {
      const children = trimCell(cell);
      return {
        type: "tableCell",
        children: children.length ? [{ type: "paragraph", children }] : []
      };
    })
  });
  return { type: "table", children: [asRow(headerCells), ...body.map(asRow)] };
}

function paragraphHasPipe(node: GenericNode): boolean {
  return (node.children ?? []).some(
    (child) => (child.type === "text" && String(child.value ?? "").includes("|")) || paragraphHasPipe(child)
  );
}

function mergeParagraphs(paragraphs: GenericNode[]): GenericNode {
  const children: GenericNode[] = [];
  paragraphs.forEach((paragraph, index) => {
    if (index) children.push({ type: "text", value: "\n" });
    children.push(...(paragraph.children ?? []));
  });
  return { type: "paragraph", children };
}

function tableFromParagraph(node: GenericNode): GenericNode | null {
  const rows = rowsFromParagraph(node);
  return rows ? tableFromRows(rows) : null;
}

/** A pipe table that failed GFM column matching arrives as one paragraph — or several. */
export function promotePipeParagraphs(node: GenericNode): GenericNode {
  if (node.type === "paragraph") return tableFromParagraph(node) ?? node;
  if (!node.children) return node;
  const mapped = node.children.map(promotePipeParagraphs);
  const children: GenericNode[] = [];
  for (let index = 0; index < mapped.length; index += 1) {
    const current = mapped[index] as GenericNode;
    if (current.type !== "paragraph") {
      children.push(current);
      continue;
    }
    const run = [current];
    let next = index + 1;
    while (next < mapped.length && mapped[next]?.type === "paragraph" && paragraphHasPipe(mapped[next] as GenericNode)) {
      run.push(mapped[next] as GenericNode);
      next += 1;
    }
    if (run.length > 1) {
      const table = tableFromParagraph(mergeParagraphs(run));
      if (table) {
        children.push(table);
        index = next - 1;
        continue;
      }
    }
    children.push(tableFromParagraph(current) ?? current);
  }
  return { ...node, children };
}

/** myst-to-md writes a ragged table poorly — keep every row the same width. */
export function padTableColumns(node: GenericNode): GenericNode {
  if (node.type === "table" && node.children?.length) {
    const width = Math.max(1, ...node.children.map((row) => row.children?.length ?? 0));
    return {
      ...node,
      children: node.children.map((row) => {
        const cells = [...(row.children ?? [])];
        while (cells.length < width) cells.push({ type: "tableCell", children: [] });
        return { ...row, children: cells };
      })
    };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map(padTableColumns) };
}

/** Source that was already “restored” with `\\|` must be unescaped before GFM can see a table. */
export function recoverGfmTableSource(md: string): string {
  return normalizeGfmTables(unescapeGfmTablePipes(md));
}

/** myst-to-md escapes `|` at the start of a paragraph line. Undo that for table rows. */
export function unescapeGfmTablePipes(md: string): string {
  const lines = md.split("\n");
  let fence: string | null = null;
  return lines
    .map((line, index) => {
      if (fence) {
        if (line.trimStart().startsWith(fence)) fence = null;
        return line;
      }
      const opened = isFenceOpen(line);
      if (opened) {
        fence = opened;
        return line;
      }
      if (!line.startsWith("\\|")) return line;
      const unescaped = line.slice(1);
      const prev = (lines[index - 1] ?? "").replace(/^\\/, "");
      const next = (lines[index + 1] ?? "").replace(/^\\/, "");
      if (isDelimLine(unescaped) || isDelimLine(prev) || isDelimLine(next) || splitTableCells(unescaped).length >= 2) {
        return unescaped;
      }
      return line;
    })
    .join("\n");
}
