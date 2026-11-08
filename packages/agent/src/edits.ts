export interface TextEdit {
  oldText: string;
  newText: string;
}

export interface AppliedEdit extends TextEdit {
  /** 1-based line of the match in the original file. */
  line: number;
}

export type EditErrorKind = "empty" | "not-found" | "ambiguous" | "overlap" | "no-change";

export type ApplyEditsResult =
  | { ok: true; result: string; edits: AppliedEdit[] }
  | { ok: false; kind: EditErrorKind; message: string };

const NONE_APPLIED = "No edit was applied.";

function detectEol(source: string): "\n" | "\r\n" {
  let crlf = 0;
  let lf = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) !== 10) continue;
    if (i > 0 && source.charCodeAt(i - 1) === 13) crlf += 1;
    else lf += 1;
  }
  return crlf > lf ? "\r\n" : "\n";
}

function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function lineText(text: string, line: number): string {
  const lines = text.split("\n");
  const raw = lines[line - 1] ?? "";
  return raw.length > 100 ? `${raw.slice(0, 100)}...` : raw;
}

function findAll(haystack: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return found;
    found.push(at);
    from = at + 1;
  }
}

/**
 * Exact-text edits against the original source. Every `oldText` must match
 * exactly once and no two matches may overlap. Matching uses LF endings; the
 * file's original line endings and BOM are restored on the result. Either all
 * edits apply or none does. Errors are written for the model: they say what
 * went wrong, where, and what to do next.
 */
export function applyEdits(source: string, edits: TextEdit[]): ApplyEditsResult {
  if (edits.length === 0) {
    return { ok: false, kind: "empty", message: `edits is empty. ${NONE_APPLIED}` };
  }
  const bom = source.startsWith("\uFEFF");
  const eol = detectEol(source);
  const original = toLf(bom ? source.slice(1) : source);

  const located: { index: number; start: number; end: number; oldText: string; newText: string }[] = [];
  for (let i = 0; i < edits.length; i += 1) {
    const oldText = toLf(edits[i]!.oldText);
    const newText = toLf(edits[i]!.newText);
    if (oldText === "") {
      return {
        ok: false,
        kind: "empty",
        message: `edits[${i}].oldText is empty. oldText must be the exact existing text to replace. ${NONE_APPLIED}`
      };
    }
    if (oldText === newText) {
      return {
        ok: false,
        kind: "no-change",
        message: `edits[${i}] has identical oldText and newText, so it changes nothing. ${NONE_APPLIED}`
      };
    }
    const hits = findAll(original, oldText);
    if (hits.length === 0) {
      return {
        ok: false,
        kind: "not-found",
        message:
          `edits[${i}].oldText was not found in the file. Spaces, tabs, and line breaks must match exactly. ` +
          `Call readFile to get the current text and copy oldText from it. ${NONE_APPLIED}`
      };
    }
    if (hits.length > 1) {
      const lines = hits.map((at) => lineOf(original, at));
      const shown = lines
        .slice(0, 5)
        .map((line) => `line ${line}: ${JSON.stringify(lineText(original, line))}`)
        .join("; ");
      return {
        ok: false,
        kind: "ambiguous",
        message:
          `edits[${i}].oldText matches ${hits.length} places (${shown}${hits.length > 5 ? "; ..." : ""}). ` +
          `Extend oldText with surrounding text so it matches exactly one place. ${NONE_APPLIED}`
      };
    }
    located.push({ index: i, start: hits[0]!, end: hits[0]! + oldText.length, oldText, newText });
  }

  const byStart = [...located].sort((a, b) => a.start - b.start);
  for (let i = 1; i < byStart.length; i += 1) {
    const prev = byStart[i - 1]!;
    const next = byStart[i]!;
    if (next.start < prev.end) {
      return {
        ok: false,
        kind: "overlap",
        message:
          `edits[${prev.index}] and edits[${next.index}] overlap. Merge them into one edit that covers both regions. ${NONE_APPLIED}`
      };
    }
  }

  let result = original;
  for (let i = byStart.length - 1; i >= 0; i -= 1) {
    const edit = byStart[i]!;
    result = result.slice(0, edit.start) + edit.newText + result.slice(edit.end);
  }
  const withEol = eol === "\r\n" ? result.replace(/\n/g, "\r\n") : result;
  const finalText = (bom ? "\uFEFF" : "") + withEol;
  return {
    ok: true,
    result: finalText,
    edits: byStart.map((edit) => ({
      oldText: edit.oldText,
      newText: edit.newText,
      line: lineOf(original, edit.start)
    }))
  };
}
