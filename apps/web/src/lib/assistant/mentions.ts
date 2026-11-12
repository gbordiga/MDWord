export interface MentionFile {
  /** Workspace-relative path. A folder ends with `/`. */
  rel: string;
  title: string;
}

export const MENTION_LIMIT = 12;
export const FOLDER_MAX_FILES = 80;

/** Listing of a mentioned folder for the model, with a note when it is cut. */
export function folderListing(folder: string, paths: readonly string[], max = FOLDER_MAX_FILES): string {
  const inside = paths.filter((p) => p.startsWith(folder));
  if (inside.length === 0) return "(no files)";
  const shown = inside.slice(0, max);
  const more = inside.length - shown.length;
  return more > 0 ? `${shown.join("\n")}\n(${more} more files not listed; use listDocuments or search)` : shown.join("\n");
}

export function isFolderMention(rel: string): boolean {
  return rel.endsWith("/");
}

/**
 * `@query` being typed at the caret, when `@` starts a token. `end` is the end of the whole token,
 * so choosing a file replaces the text after the caret too, not only the part before it.
 */
export function activeMention(
  text: string,
  cursor: number
): { start: number; end: number; query: string } | null {
  const upto = text.slice(0, cursor);
  const match = upto.match(/(^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  const tail = text.slice(cursor).match(/^[^\s@]*/)?.[0] ?? "";
  return { start: cursor - query.length - 1, end: cursor + tail.length, query };
}

export function filterMentionFiles(files: MentionFile[], query: string): MentionFile[] {
  const q = query.toLowerCase();
  const matching = files.filter((file) => !q || file.rel.toLowerCase().includes(q) || file.title.toLowerCase().includes(q));
  // Folders first (at most 5, so they cannot push every file out), then files and documents.
  const folders = matching.filter((f) => isFolderMention(f.rel));
  const rest = matching.filter((f) => !isFolderMention(f.rel));
  const head = folders.slice(0, 5);
  return [...head, ...rest, ...folders.slice(5)].slice(0, MENTION_LIMIT);
}

export interface MentionSegment {
  text: string;
  mention: boolean;
}

interface MentionHit {
  start: number;
  end: number;
  rel: string;
}

const AFTER_PATH = /[\s.,;:!?)]/;

/**
 * Every `@path` in the draft that names a known file. Paths are matched against the list, longest
 * first, so names with spaces (`notes (2).md`) work and `a.md` does not swallow `a.md.bak`.
 */
function findMentions(text: string, known: string[]): MentionHit[] {
  const byLength = [...known].sort((a, b) => b.length - a.length);
  const lower = text.toLowerCase();
  const hits: MentionHit[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "@" && (i === 0 || /\s/.test(text[i - 1] ?? ""))) {
      const rel = byLength.find((path) => {
        if (!lower.startsWith(path.toLowerCase(), i + 1)) return false;
        const next = text[i + 1 + path.length];
        return next === undefined || AFTER_PATH.test(next);
      });
      if (rel) {
        const end = i + 1 + rel.length;
        hits.push({ start: i, end, rel });
        i = end;
        continue;
      }
    }
    i += 1;
  }
  return hits;
}

/** Split the draft so every `@path` that names a real file can be drawn as a badge. */
export function splitMentions(text: string, known: string[]): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  for (const hit of findMentions(text, known)) {
    if (hit.start > last) out.push({ text: text.slice(last, hit.start), mention: false });
    out.push({ text: text.slice(hit.start, hit.end), mention: true });
    last = hit.end;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}

/** Workspace paths the user named with `@path` that exist in the folder. */
export function mentionedPaths(text: string, known: string[]): string[] {
  const found: string[] = [];
  for (const hit of findMentions(text, known)) {
    if (!found.includes(hit.rel)) found.push(hit.rel);
  }
  return found;
}
