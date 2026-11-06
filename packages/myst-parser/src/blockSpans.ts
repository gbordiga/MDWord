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

/** Longest increasing subsequence of the second coordinate, pairs sorted by the first. */
function longestIncreasingPairs(pairs: [number, number][]): [number, number][] {
  if (!pairs.length) return [];
  // tails[k] = index in `pairs` of the smallest tail of an increasing run of length k+1.
  const tails: number[] = [];
  const previous = new Array<number>(pairs.length).fill(-1);
  for (let index = 0; index < pairs.length; index++) {
    const value = pairs[index]![1];
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (pairs[tails[mid]!]![1] < value) low = mid + 1;
      else high = mid;
    }
    if (low > 0) previous[index] = tails[low - 1]!;
    tails[low] = index;
  }
  const out: [number, number][] = [];
  let cursor = tails[tails.length - 1] ?? -1;
  while (cursor >= 0) {
    out.push(pairs[cursor]!);
    cursor = previous[cursor]!;
  }
  return out.reverse();
}

/**
 * Align body lines with display lines. The display text is a rewrite of the body
 * (wiki links, embedded images, GFM tables), so most lines are identical and the
 * rest are whole-line insertions or deletions. Anchoring on lines that occur once
 * on each side and taking their longest increasing run keeps the mapping accurate
 * while staying O(n log n); the previous full LCS was O(n·m) and made opening a
 * document with many tables take hundreds of milliseconds.
 */
function alignedLinePairs(a: string[], b: string[]): [number, number][] {
  const pairs: [number, number][] = [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    pairs.push([start, start]);
    start += 1;
  }
  const suffix: [number, number][] = [];
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    suffix.push([endA, endB]);
    endA -= 1;
    endB -= 1;
  }

  const countA = new Map<string, number>();
  for (let i = start; i <= endA; i++) {
    const line = a[i]!;
    countA.set(line, (countA.get(line) ?? 0) + 1);
  }
  const countB = new Map<string, number>();
  const positionB = new Map<string, number>();
  for (let j = start; j <= endB; j++) {
    const line = b[j]!;
    const seen = (countB.get(line) ?? 0) + 1;
    countB.set(line, seen);
    if (seen === 1) positionB.set(line, j);
    else positionB.delete(line);
  }
  const anchors: [number, number][] = [];
  for (let i = start; i <= endA; i++) {
    const line = a[i]!;
    if (countA.get(line) !== 1) continue;
    const j = positionB.get(line);
    if (j != null) anchors.push([i, j]);
  }

  return [...pairs, ...longestIncreasingPairs(anchors), ...suffix.reverse()];
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
  for (const [bodyIndex, displayIndex] of alignedLinePairs(bodyLines, displayLines)) {
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

function spanFromLines(body: string, starts: number[], startLine: number, endLine: number): SourceSpan {
  const start = starts[Math.max(0, startLine - 1)] ?? 0;
  const end = starts[endLine] ?? body.length;
  return { start, end: Math.max(start, end) };
}

export function blockSpansFromAst(ast: GenericNode, body: string, display: string): SourceSpan[] {
  const children = ast.children ?? [];
  if (!children.length) return [];
  const mapLine = mapDisplayLineToBody(body, display);
  const starts = lineStartOffsets(body);
  const spans: SourceSpan[] = [];
  for (const child of children) {
    const range = nodeLineRange(child);
    if (!range) return [];
    const startLine = mapLine(range.start);
    const endLine = mapLine(range.end);
    spans.push(spanFromLines(body, starts, Math.min(startLine, endLine), Math.max(startLine, endLine)));
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
