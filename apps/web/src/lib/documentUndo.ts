export type DocumentUndoState = {
  past: string[];
  future: string[];
  lastKind: string | null;
  lastAt: number;
};

export const DOCUMENT_UNDO_COALESCE_MS = 500;
const MAX_PAST = 80;

export function emptyDocumentUndo(): DocumentUndoState {
  return { past: [], future: [], lastKind: null, lastAt: 0 };
}

export function recordDocumentChange(
  state: DocumentUndoState,
  previousSource: string,
  nextSource: string,
  kind: string,
  now = Date.now()
): DocumentUndoState {
  if (previousSource === nextSource) return state;
  const coalesce =
    Boolean(kind) &&
    kind === state.lastKind &&
    now - state.lastAt <= DOCUMENT_UNDO_COALESCE_MS &&
    state.past.length > 0;
  if (coalesce) {
    return { ...state, future: [], lastAt: now };
  }
  return {
    past: [...state.past, previousSource].slice(-MAX_PAST),
    future: [],
    lastKind: kind,
    lastAt: now
  };
}

export function undoDocumentChange(
  state: DocumentUndoState,
  currentSource: string
): { state: DocumentUndoState; source: string } | null {
  const previous = state.past[state.past.length - 1];
  if (previous == null) return null;
  return {
    source: previous,
    state: {
      past: state.past.slice(0, -1),
      future: [...state.future, currentSource],
      lastKind: null,
      lastAt: 0
    }
  };
}

export function redoDocumentChange(
  state: DocumentUndoState,
  currentSource: string
): { state: DocumentUndoState; source: string } | null {
  const next = state.future[state.future.length - 1];
  if (next == null) return null;
  return {
    source: next,
    state: {
      past: [...state.past, currentSource].slice(-MAX_PAST),
      future: state.future.slice(0, -1),
      lastKind: null,
      lastAt: 0
    }
  };
}

export function frontmatterUndoKind(patch: Record<string, unknown>): string {
  return `frontmatter:${Object.keys(patch).sort().join(",")}`;
}

export function mdocUndoKind(previous: unknown, next: unknown): string {
  const prev = previous && typeof previous === "object" ? (previous as Record<string, unknown>) : {};
  const curr = next && typeof next === "object" ? (next as Record<string, unknown>) : {};
  const keys = [...new Set([...Object.keys(prev), ...Object.keys(curr)])]
    .filter((key) => JSON.stringify(prev[key]) !== JSON.stringify(curr[key]))
    .sort();
  return `mdoc:${keys.join(",") || "all"}`;
}
