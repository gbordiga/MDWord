import { t, type ModelMessage } from "@mdword/agent";


export interface EditCardEdit {
  line: number;
  oldText: string;
  newText: string;
}

export type ThreadItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      label: string;
      status: "running" | "ok" | "error";
      detail?: string;
    }
  | {
      kind: "edit";
      id: string;
      path: string;
      edits: EditCardEdit[];
      status: "pending" | "applied" | "discarded" | "stale";
    }
  | { kind: "notice"; id: string; text: string };

export function toolLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const path = typeof i.path === "string" ? i.path : "";
  switch (name) {
    case "listFiles":
      return t("tool.listFiles", {
        folder: typeof i.folder === "string" && i.folder ? i.folder : t("tool.listFiles.root")
      });
    case "search":
      return t("tool.search", { query: typeof i.query === "string" ? i.query : "" });
    case "readFile":
      return typeof i.startLine === "number" && typeof i.endLine === "number"
        ? t("tool.readFile.range", { path, start: i.startLine, end: i.endLine })
        : t("tool.readFile", { path });
    case "editFile":
      return t("tool.editFile", { path });
    default:
      return name;
  }
}

/**
 * Model history rebuilt from the saved thread. Only what the user and the
 * assistant said is kept: tool results (file text) are never stored, so a
 * reloaded chat starts without them and the model reads files again if needed.
 */
export function historyFromThread(thread: ThreadItem[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const item of thread) {
    if (item.kind === "user") out.push({ role: "user", content: item.text });
    else if (item.kind === "assistant" && item.text.trim()) {
      out.push({ role: "assistant", content: item.text });
    }
  }
  return out;
}

const VERSION = 1;
const MAX_ITEMS = 400;

export function serializeThread(thread: ThreadItem[]): string {
  const settled = thread
    .slice(-MAX_ITEMS)
    .map((item) =>
      item.kind === "edit" && item.status === "pending"
        ? { ...item, status: "discarded" as const }
        : item.kind === "tool" && item.status === "running"
          ? { ...item, status: "error" as const }
          : item
    );
  return JSON.stringify({ v: VERSION, thread: settled });
}

export function parseThread(json: string | null): ThreadItem[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { v?: number; thread?: unknown };
    if (parsed.v !== VERSION || !Array.isArray(parsed.thread)) return [];
    return (parsed.thread as ThreadItem[]).filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        ["user", "assistant", "tool", "edit", "notice"].includes(item.kind)
    );
  } catch {
    return [];
  }
}
