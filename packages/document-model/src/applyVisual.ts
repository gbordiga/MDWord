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

function lcsMatches(oldNodes: GenericNode[], newNodes: GenericNode[]): { oldIndex: number; newIndex: number }[] {
  const n = oldNodes.length;
  const m = newNodes.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = 1; i <= n; i++) {
    const prev = dp[i - 1]!;
    const row = dp[i]!;
    for (let j = 1; j <= m; j++) {
      row[j] = semanticAstEqual(oldNodes[i - 1]!, newNodes[j - 1]!)
        ? prev[j - 1]! + 1
        : Math.max(prev[j]!, row[j - 1]!);
    }
  }
  const matches: { oldIndex: number; newIndex: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (semanticAstEqual(oldNodes[i - 1]!, newNodes[j - 1]!)) {
      matches.push({ oldIndex: i - 1, newIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  matches.reverse();
  return matches;
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
    const before = [...matches].reverse().find((match) => {
      const origin = origins[match.oldIndex];
      return origin != null && origin.to <= parseStart;
    });
    return [(before?.newIndex ?? -1) + 1, after?.newIndex ?? visualCount];
  }
  const jLeft = [...matches].reverse().find((match) => match.oldIndex < firstOld);
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
  const unmatchedNew = newVisual
    .map((node, index) => ({ node, index }))
    .filter((item) => !matches.some((match) => match.newIndex === item.index));

  for (const item of unmatchedNew) {
    const prev = [...matches].reverse().find((match) => match.newIndex < item.index);
    const key = prev == null ? -1 : (origins[prev.oldIndex]?.to ?? 1) - 1;
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
