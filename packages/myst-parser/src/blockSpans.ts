import type { GenericNode } from "@mdword/shared";

export interface SourceSpan {
  start: number;
  end: number;
}

type NodePosition = {
  start?: { line?: number; column?: number; offset?: number };
  end?: { line?: number; column?: number; offset?: number };
};

function lineStartOffsets(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = 1; i <= n; i++) {
    const prev = dp[i - 1]!;
    const row = dp[i]!;
    for (let j = 1; j <= m; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, row[j - 1]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  pairs.reverse();
  return pairs;
}

/** 1-based display line → 1-based body line. */
export function mapDisplayLineToBody(body: string, display: string): (displayLine: number) => number {
  const bodyLines = body.split("\n");
  const displayLines = display.split("\n");
  const bodyMax = Math.max(1, bodyLines.length);
  if (bodyLines.length === displayLines.length) {
    return (line) => Math.min(Math.max(1, line), bodyMax);
  }
  const map = new Array<number>(displayLines.length).fill(-1);
  for (const [bodyIndex, displayIndex] of lcsPairs(bodyLines, displayLines)) {
    map[displayIndex] = bodyIndex;
  }
  let last = 0;
  for (let j = 0; j < map.length; j++) {
    if (map[j]! >= 0) last = map[j]!;
    else map[j] = last;
  }
  return (displayLine) => {
    const idx = displayLine - 1;
    if (idx <= 0) return 1;
    if (idx >= map.length) return bodyMax;
    return Math.min((map[idx] ?? 0) + 1, bodyMax);
  };
}

function nodeLineRange(node: GenericNode): { start: number; end: number } | null {
  const pos = node.position as NodePosition | undefined;
  if (pos?.start?.line && pos?.end?.line) {
    return { start: pos.start.line, end: Math.max(pos.start.line, pos.end.line) };
  }
  const children = node.children ?? [];
  if (!children.length) return null;
  const first = nodeLineRange(children[0]!);
  const last = nodeLineRange(children[children.length - 1]!);
  if (!first || !last) return null;
  return { start: first.start, end: last.end };
}

function spanFromLines(body: string, startLine: number, endLine: number): SourceSpan {
  const starts = lineStartOffsets(body);
  const start = starts[Math.max(0, startLine - 1)] ?? 0;
  const end = starts[endLine] ?? body.length;
  return { start, end: Math.max(start, end) };
}

export function blockSpansFromAst(ast: GenericNode, body: string, display: string): SourceSpan[] {
  const children = ast.children ?? [];
  if (!children.length) return [];
  const mapLine = mapDisplayLineToBody(body, display);
  const spans: SourceSpan[] = [];
  for (const child of children) {
    const range = nodeLineRange(child);
    if (!range) return [];
    const startLine = mapLine(range.start);
    const endLine = mapLine(range.end);
    spans.push(spanFromLines(body, Math.min(startLine, endLine), Math.max(startLine, endLine)));
  }
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1]!;
    const next = spans[i]!;
    if (next.start < prev.end) next.start = prev.end;
    if (next.end < next.start) next.end = next.start;
  }
  const last = spans[spans.length - 1];
  if (last && last.end > body.length) last.end = body.length;
  return spans;
}
