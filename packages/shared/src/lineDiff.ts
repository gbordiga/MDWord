export type LineChangeKind = "equal" | "add" | "remove";

export interface LineChange {
  kind: LineChangeKind;
  text: string;
}

function lcsBacktrack(a: string[], b: string[]): LineChange[] {
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
  const out: LineChange[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const left = a[i - 1]!;
    const right = b[j - 1]!;
    if (left === right) {
      out.push({ kind: "equal", text: left });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push({ kind: "remove", text: left });
      i -= 1;
    } else {
      out.push({ kind: "add", text: right });
      j -= 1;
    }
  }
  while (i > 0) {
    out.push({ kind: "remove", text: a[i - 1]! });
    i -= 1;
  }
  while (j > 0) {
    out.push({ kind: "add", text: b[j - 1]! });
    j -= 1;
  }
  return out.reverse();
}

/** Line-oriented diff. Uses LCS on the middle hunk; falls back to replace when huge. */
export function diffLines(before: string, after: string): LineChange[] {
  if (before === after) {
    return before.split("\n").map((text) => ({ kind: "equal" as const, text }));
  }
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let aEnd = a.length - 1;
  let bEnd = b.length - 1;
  while (aEnd >= start && bEnd >= start && a[aEnd] === b[bEnd]) {
    aEnd -= 1;
    bEnd -= 1;
  }
  const prefix = a.slice(0, start).map((text) => ({ kind: "equal" as const, text }));
  const suffix = a.slice(aEnd + 1).map((text) => ({ kind: "equal" as const, text }));
  const midA = a.slice(start, aEnd + 1);
  const midB = b.slice(start, bEnd + 1);
  if (midA.length * midB.length > 250_000) {
    return [
      ...prefix,
      ...midA.map((text) => ({ kind: "remove" as const, text })),
      ...midB.map((text) => ({ kind: "add" as const, text })),
      ...suffix
    ];
  }
  return [...prefix, ...lcsBacktrack(midA, midB), ...suffix];
}

export function countLineChanges(changes: LineChange[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const change of changes) {
    if (change.kind === "add") added += 1;
    if (change.kind === "remove") removed += 1;
  }
  return { added, removed };
}
