import { serializeMarkdown, serializeMarkdownFragment } from "@mdword/markdown-serializer";
import type { Mdoc } from "@mdword/layout-engine";
import { canonicalizeEmbeddedImages, type GenericNode } from "@mdword/shared";
import type { DocumentModel } from "./index";
import { composeMarkdown } from "./sourceCompose";
import { semanticAstEqual } from "./semantic";

export interface VisualOrigin {
  from: number;
  to: number;
}

export interface ApplyVisualOptions {
  previous: GenericNode;
  origins: VisualOrigin[];
  workspaceMdoc?: Mdoc;
}

/** Comparing two blocks means a full semantic walk, so keep the DP small. */
const MAX_LCS_CELLS = 20_000;

/**
 * Match unchanged top-level blocks between two versions of the document.
 *
 * A visual edit touches one region, so the unchanged prefix and suffix are
 * matched directly and only the differing middle goes through LCS. The previous
 * full-matrix LCS cost O(n²) semantic comparisons on every keystroke: 3.6 s for a
 * 720-block document. When the middle is too large to diff cheaply it is treated
 * as changed, which rewrites more blocks but stays correct.
 */
function lcsMatches(oldNodes: GenericNode[], newNodes: GenericNode[]): { oldIndex: number; newIndex: number }[] {
  let start = 0;
  const shortest = Math.min(oldNodes.length, newNodes.length);
  const prefix: { oldIndex: number; newIndex: number }[] = [];
  while (start < shortest && semanticAstEqual(oldNodes[start]!, newNodes[start]!)) {
    prefix.push({ oldIndex: start, newIndex: start });
    start += 1;
  }
  const suffix: { oldIndex: number; newIndex: number }[] = [];
  let oldEnd = oldNodes.length - 1;
  let newEnd = newNodes.length - 1;
  while (
    oldEnd >= start &&
    newEnd >= start &&
    semanticAstEqual(oldNodes[oldEnd]!, newNodes[newEnd]!)
  ) {
    suffix.push({ oldIndex: oldEnd, newIndex: newEnd });
    oldEnd -= 1;
    newEnd -= 1;
  }

  const n = oldEnd - start + 1;
  const m = newEnd - start + 1;
  const middle: { oldIndex: number; newIndex: number }[] = [];
  if (n > 0 && m > 0 && n * m <= MAX_LCS_CELLS) {
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
    for (let i = 1; i <= n; i++) {
      const prev = dp[i - 1]!;
      const row = dp[i]!;
      for (let j = 1; j <= m; j++) {
        row[j] = semanticAstEqual(oldNodes[start + i - 1]!, newNodes[start + j - 1]!)
          ? prev[j - 1]! + 1
          : Math.max(prev[j]!, row[j - 1]!);
      }
    }
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
      if (semanticAstEqual(oldNodes[start + i - 1]!, newNodes[start + j - 1]!)) {
        middle.push({ oldIndex: start + i - 1, newIndex: start + j - 1 });
        i -= 1;
        j -= 1;
      } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
        i -= 1;
      } else {
        j -= 1;
      }
    }
    middle.reverse();
  }

  return [...prefix, ...middle, ...suffix.reverse()];
}

function dirtyRuns(dirty: Set<number>): [number, number][] {
  const sorted = [...dirty].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const index of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else runs.push([index, index + 1]);
  }
  return runs;
}

function joinFragments(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("\n\n");
}

function fallbackSource(model: DocumentModel, nextAst: GenericNode): string {
  try {
    return serializeMarkdown({ ast: nextAst, yaml: model.yamlCst });
  } catch {
    return model.source;
  }
}

function spansValid(model: DocumentModel): boolean {
  const kids = model.ast.children ?? [];
  if (model.blockSpans.length !== kids.length) return false;
  let last = 0;
  for (const span of model.blockSpans) {
    if (span.start < 0 || span.end < span.start || span.end > model.body.length) return false;
    if (span.start < last) return false;
    last = span.start;
  }
  return true;
}

function replacementRange(
  matches: { oldIndex: number; newIndex: number }[],
  origins: VisualOrigin[],
  parseStart: number,
  parseEnd: number,
  visualCount: number
): [number, number] {
  let firstOld = Number.POSITIVE_INFINITY;
  let lastOld = -1;
  for (let i = 0; i < origins.length; i++) {
    const origin = origins[i]!;
    if (origin.to <= parseStart || origin.from >= parseEnd) continue;
    firstOld = Math.min(firstOld, i);
    lastOld = Math.max(lastOld, i);
  }
  if (firstOld === Number.POSITIVE_INFINITY) {
    const after = matches.find((match) => {
      const origin = origins[match.oldIndex];
      return origin != null && origin.from >= parseEnd;
    });
    let before: { oldIndex: number; newIndex: number } | undefined;
    for (let i = matches.length - 1; i >= 0; i--) {
      const origin = origins[matches[i]!.oldIndex];
      if (origin != null && origin.to <= parseStart) {
        before = matches[i];
        break;
      }
    }
    return [(before?.newIndex ?? -1) + 1, after?.newIndex ?? visualCount];
  }
  let jLeft: { oldIndex: number; newIndex: number } | undefined;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i]!.oldIndex < firstOld) {
      jLeft = matches[i];
      break;
    }
  }
  const jRight = matches.find((match) => match.oldIndex > lastOld);
  return [(jLeft?.newIndex ?? -1) + 1, jRight?.newIndex ?? visualCount];
}

function replacementNodes(
  newVisual: GenericNode[],
  matches: { oldIndex: number; newIndex: number }[],
  origins: VisualOrigin[],
  parseStart: number,
  parseEnd: number
): GenericNode[] {
  const [from, to] = replacementRange(matches, origins, parseStart, parseEnd, newVisual.length);
  return newVisual.slice(from, to);
}

function rebuildBody(
  model: DocumentModel,
  oldVisual: GenericNode[],
  newVisual: GenericNode[],
  origins: VisualOrigin[]
): string | null {
  const parseKids = model.ast.children ?? [];
  const body = model.body;
  const matches = lcsMatches(oldVisual, newVisual);
  const matchedOld = new Set(matches.map((match) => match.oldIndex));
  const dirty = new Set<number>();
  if (origins.length !== oldVisual.length) return null;

  for (let i = 0; i < oldVisual.length; i++) {
    if (matchedOld.has(i)) continue;
    const origin = origins[i]!;
    for (let parseIndex = origin.from; parseIndex < origin.to; parseIndex++) dirty.add(parseIndex);
  }

  const insertsAfter = new Map<number, { node: GenericNode; index: number }[]>();
  const matchedNew = new Set(matches.map((match) => match.newIndex));
  const unmatchedNew = newVisual
    .map((node, index) => ({ node, index }))
    .filter((item) => !matchedNew.has(item.index));

  let anchor = 0;
  let previous: { oldIndex: number; newIndex: number } | undefined;
  for (const item of unmatchedNew) {
    while (anchor < matches.length && matches[anchor]!.newIndex < item.index) {
      previous = matches[anchor]!;
      anchor += 1;
    }
    const key = previous == null ? -1 : (origins[previous.oldIndex]?.to ?? 1) - 1;
    const list = insertsAfter.get(key) ?? [];
    list.push(item);
    insertsAfter.set(key, list);
  }

  const runs = dirtyRuns(dirty);
  const runAt = new Map<number, [number, number]>();
  for (const run of runs) runAt.set(run[0], run);

  const coveredNew = new Set<number>();
  for (const run of runs) {
    const [from, to] = replacementRange(matches, origins, run[0], run[1], newVisual.length);
    for (let index = from; index < to; index++) coveredNew.add(index);
  }

  let out = "";
  let cursor = 0;
  const emitThrough = (offset: number) => {
    if (offset > cursor) {
      out += body.slice(cursor, offset);
      cursor = offset;
    }
  };

  const emitInserts = (items: { node: GenericNode; index: number }[] | undefined) => {
    const nodes = items?.filter((item) => !coveredNew.has(item.index)).map((item) => item.node);
    if (!nodes?.length) return;
    const fragment = serializeMarkdownFragment(nodes);
    if (!fragment) return;
    if (out && !out.endsWith("\n\n") && !fragment.startsWith("\n")) {
      out += out.endsWith("\n") ? "\n" : "\n\n";
    }
    out += fragment;
    if (!out.endsWith("\n")) out += "\n";
  };

  emitInserts(insertsAfter.get(-1));

  for (let parseIndex = 0; parseIndex < parseKids.length; parseIndex++) {
    const run = runAt.get(parseIndex);
    const span = model.blockSpans[parseIndex]!;
    if (run) {
      emitThrough(span.start);
      const nodes = replacementNodes(newVisual, matches, origins, run[0], run[1]);
      const fragment = serializeMarkdownFragment(nodes);
      if (fragment) {
        out += fragment;
        if (!out.endsWith("\n")) out += "\n";
      }
      const lastSpan = model.blockSpans[run[1] - 1]!;
      cursor = lastSpan.end;
      parseIndex = run[1] - 1;
      emitInserts(insertsAfter.get(parseIndex));
      continue;
    }
    emitThrough(span.end);
    emitInserts(insertsAfter.get(parseIndex));
  }

  emitThrough(body.length);
  return out;
}

export function applyVisualAst(
  model: DocumentModel,
  nextAst: GenericNode,
  options: ApplyVisualOptions,
  open: (source: string, workspaceMdoc?: Mdoc) => DocumentModel
): DocumentModel {
  if (semanticAstEqual(options.previous, nextAst)) return model;
  const oldVisual = options.previous.children ?? [];
  const newVisual = nextAst.children ?? [];

  if (!spansValid(model) || !options.origins.length) {
    return open(fallbackSource(model, nextAst), options.workspaceMdoc);
  }

  try {
    const nextBody = rebuildBody(model, oldVisual, newVisual, options.origins);
    if (nextBody == null) return open(fallbackSource(model, nextAst), options.workspaceMdoc);
    const source = composeMarkdown(model.head, canonicalizeEmbeddedImages(nextBody));
    if (source === model.source) return model;
    return open(source, options.workspaceMdoc);
  } catch (error) {
    console.error("Could not patch markdown from visual edits", error);
    return open(fallbackSource(model, nextAst), options.workspaceMdoc);
  }
}
