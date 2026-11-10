import { DEFAULT_FIND_OPTIONS, compileFind, findInText, type FindOptions } from "@mdword/shared";

export interface TextChunk {
  pos: number;
  text: string;
  /** False for text that is not a real text node (a diagram source): found, never replaced. */
  replaceable?: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
  replacement?: string;
  replaceable?: boolean;
}

export function collectSearchMatches(
  chunks: TextChunk[],
  query: string,
  options: FindOptions = DEFAULT_FIND_OPTIONS,
  replace = ""
): SearchMatch[] {
  const compiled = compileFind(query, options);
  if (!compiled || !compiled.ok) return [];
  const matches: SearchMatch[] = [];
  for (const chunk of chunks) {
    for (const m of findInText(chunk.text, compiled.re, replace, options.regex)) {
      matches.push({
        from: chunk.pos + m.from,
        to: chunk.pos + m.to,
        replacement: m.replacement,
        replaceable: chunk.replaceable !== false
      });
    }
  }
  return matches;
}

/** Next/previous match after the caret. Wraps around the document. */
export function nextMatchIndex(matches: SearchMatch[], from: number, direction: 1 | -1): number {
  if (!matches.length) return -1;
  if (direction === 1) {
    const idx = matches.findIndex((m) => m.from >= from);
    return idx >= 0 ? idx : 0;
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i]!.from < from) return i;
  }
  return matches.length - 1;
}
