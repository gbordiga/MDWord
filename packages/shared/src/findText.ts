/** Text search shared by the visual editor and the source editor. */
export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export const DEFAULT_FIND_OPTIONS: FindOptions = { caseSensitive: false, wholeWord: false, regex: false };

/** Hard cap so a pattern that matches everywhere cannot flood the page with highlights. */
export const MAX_FIND_MATCHES = 5000;

export interface FoundRange {
  from: number;
  to: number;
  /** Replacement text for this match, with $1, $& and $<name> already expanded. */
  replacement: string;
}

export type CompiledFind = { ok: true; re: RegExp } | { ok: false; error: string } | null;

const WORD = "[\\p{L}\\p{N}_]";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Null for a blank query, an error for a pattern that does not compile. */
export function compileFind(query: string, options: FindOptions): CompiledFind {
  const text = options.regex ? query : query.trim();
  if (!text) return null;
  const body = options.regex ? text : escapeRegExp(text);
  const source = options.wholeWord ? `(?<!${WORD})(?:${body})(?!${WORD})` : body;
  // Plain and whole-word searches use unicode mode for \p{L}. A user pattern keeps the
  // familiar non-unicode syntax, so escapes like \- still work.
  const flags = `g${options.caseSensitive ? "" : "i"}${options.regex && !options.wholeWord ? "" : "u"}`;
  try {
    return { ok: true, re: new RegExp(source, flags) };
  } catch {
    return { ok: false, error: "Invalid pattern" };
  }
}

function expand(template: string, m: RegExpExecArray): string {
  return template.replace(/\$(\$|&|\d{1,2}|<[^>]+>)/g, (whole, token: string) => {
    if (token === "$") return "$";
    if (token === "&") return m[0];
    if (token.startsWith("<")) return m.groups?.[token.slice(1, -1)] ?? "";
    const n = Number(token);
    return n > 0 && n < m.length ? (m[n] ?? "") : whole;
  });
}

/** All non-empty matches in one piece of text. */
export function findInText(text: string, re: RegExp, replace: string, regexMode: boolean): FoundRange[] {
  const found: FoundRange[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && found.length < MAX_FIND_MATCHES) {
    if (m[0] === "") {
      re.lastIndex += 1;
      continue;
    }
    found.push({ from: m.index, to: m.index + m[0].length, replacement: regexMode ? expand(replace, m) : replace });
  }
  return found;
}
