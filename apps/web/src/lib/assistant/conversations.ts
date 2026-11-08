import type { ThreadItem } from "./thread";

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ConversationIndex {
  conversations: ConversationMeta[];
  activeId: string | null;
}

const VERSION = 1;
export const MAX_CONVERSATIONS = 200;
const TITLE_MAX = 60;

/** Storage keys. The host stores opaque strings, so one workspace key fans out into several. */
export const indexKey = (workspaceKey: string) => `${workspaceKey}\u0000index`;
export const conversationKey = (workspaceKey: string, id: string) => `${workspaceKey}\u0000c:${id}`;

export function titleFromThread(thread: ThreadItem[]): string {
  const first = thread.find((i) => i.kind === "user");
  const text = first && first.kind === "user" ? first.text.replace(/\s+/g, " ").trim() : "";
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}\u2026` : text;
}

export function serializeIndex(index: ConversationIndex): string {
  const conversations = [...index.conversations].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  return JSON.stringify({ v: VERSION, conversations, activeId: index.activeId });
}

export function parseIndex(json: string | null): ConversationIndex | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { v?: number; conversations?: unknown; activeId?: unknown };
    if (parsed.v !== VERSION || !Array.isArray(parsed.conversations)) return null;
    const conversations = (parsed.conversations as ConversationMeta[]).filter(
      (c) => c && typeof c.id === "string" && typeof c.title === "string" && typeof c.updatedAt === "number"
    );
    return { conversations, activeId: typeof parsed.activeId === "string" ? parsed.activeId : null };
  } catch {
    return null;
  }
}

export type DayGroup = "today" | "yesterday" | "week" | "older";

export function dayGroup(updatedAt: number, now: number = Date.now()): DayGroup {
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(updatedAt)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "week";
  return "older";
}

export function filterConversations(list: ConversationMeta[], query: string): ConversationMeta[] {
  const q = query.trim().toLowerCase();
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  return q ? sorted.filter((c) => c.title.toLowerCase().includes(q)) : sorted;
}
