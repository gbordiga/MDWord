export interface TextChunk {
  pos: number;
  text: string;
}

export interface SearchMatch {
  from: number;
  to: number;
}

export function collectSearchMatches(chunks: TextChunk[], query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches: SearchMatch[] = [];
  for (const chunk of chunks) {
    const lower = chunk.text.toLowerCase();
    let start = 0;
    while (start < lower.length) {
      const idx = lower.indexOf(needle, start);
      if (idx < 0) break;
      matches.push({ from: chunk.pos + idx, to: chunk.pos + idx + needle.length });
      start = idx + 1;
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
