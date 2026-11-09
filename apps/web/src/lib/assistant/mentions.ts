export interface MentionFile {
  rel: string;
  title: string;
}

/** `@query` being typed at the caret, when `@` starts a token. */
export function activeMention(text: string, cursor: number): { start: number; query: string } | null {
  const upto = text.slice(0, cursor);
  const match = upto.match(/(^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  return { start: cursor - query.length - 1, query };
}

export function filterMentionFiles(files: MentionFile[], query: string): MentionFile[] {
  const q = query.toLowerCase();
  return files
    .filter((file) => !q || file.rel.toLowerCase().includes(q) || file.title.toLowerCase().includes(q))
    .slice(0, 12);
}

export interface MentionSegment {
  text: string;
  mention: boolean;
}

/** Split the draft so every `@path` that names a real file can be drawn as a badge. */
export function splitMentions(text: string, known: string[]): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/(^|\s)@(\S+)/g)) {
    const lead = match[1] ?? "";
    const raw = match[2] ?? "";
    const trimmed = raw.replace(/[.,;:!?)]+$/, "");
    const hit = known.find((path) => path.toLowerCase() === trimmed.toLowerCase());
    if (!hit) continue;
    const start = (match.index ?? 0) + lead.length;
    const end = start + 1 + trimmed.length;
    if (start > last) out.push({ text: text.slice(last, start), mention: false });
    out.push({ text: text.slice(start, end), mention: true });
    last = end;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}

/** Workspace paths the user named with `@path` that exist in the folder. */
export function mentionedPaths(text: string, known: string[]): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/(^|\s)@(\S+)/g)) {
    const raw = (match[2] ?? "").replace(/[.,;:!?)]+$/, "");
    const hit = known.find((path) => path === raw || path.toLowerCase() === raw.toLowerCase());
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}
