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
      /** A new file rather than a change to an existing one. */
      create?: boolean;
      status: "pending" | "applied" | "discarded" | "stale";
    }
  | {
      kind: "command";
      id: string;
      shell: "bash" | "powershell";
      command: string;
      /** Folder inside the project; empty for the root. */
      folder: string;
      /** Who approved it. Set once it runs or is denied. */
      approval: "manual" | "ai" | "always";
      /** Why the card asks, when an automatic mode could not approve it. */
      why?: { kind: "filter" | "ai"; reason: string };
      status: "pending" | "running" | "done" | "denied" | "failed";
      exitCode?: number | null;
      durationMs?: number;
      timedOut?: boolean;
      cancelled?: boolean;
      timeoutMs?: number;
      changed?: string[];
      error?: string;
      /** Memory only. Never saved: history holds no command output (ADR-011). */
      output?: string;
    }
  | { kind: "notice"; id: string; text: string };

export type ToolItem = Extract<ThreadItem, { kind: "tool" }>;
export type CommandItem = Extract<ThreadItem, { kind: "command" }>;
/** A step inside the work accordion: a tool, or a command that already left the approval card. */
export type WorkEntry = ToolItem | CommandItem;
export type ThreadBlock = { kind: "work"; id: string; entries: WorkEntry[] } | { kind: "item"; item: ThreadItem };

/** A command still waiting for Run or Deny stays a card. Once it runs, it joins the steps. */
function isWorkEntry(item: ThreadItem): item is WorkEntry {
  return item.kind === "tool" || (item.kind === "command" && item.status !== "pending" && item.status !== "denied");
}

/** Consecutive tool steps become one "work" block; anything else stands alone. */
export function groupThread(thread: ThreadItem[]): ThreadBlock[] {
  const blocks: ThreadBlock[] = [];
  for (const item of thread) {
    if (isWorkEntry(item)) {
      const last = blocks.at(-1);
      if (last?.kind === "work") last.entries.push(item);
      else blocks.push({ kind: "work", id: item.id, entries: [item] });
    } else blocks.push({ kind: "item", item });
  }
  return blocks;
}

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
    case "writeFile":
      return t("tool.writeFile", { path });
    case "runCommand":
      return t("tool.runCommand");
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

/** A saved command keeps no output, and one that never finished is closed. */
function settleCommand(item: Extract<ThreadItem, { kind: "command" }>): ThreadItem {
  const { output: _output, ...rest } = item;
  void _output;
  if (item.status === "pending") return { ...rest, status: "denied" };
  if (item.status === "running") return { ...rest, status: "failed" };
  return rest;
}

export function serializeThread(thread: ThreadItem[]): string {
  const settled = thread
    .slice(-MAX_ITEMS)
    .map((item) =>
      item.kind === "edit" && item.status === "pending"
        ? { ...item, status: "discarded" as const }
        : item.kind === "tool" && item.status === "running"
          ? { ...item, status: "error" as const }
          : item.kind === "command"
            ? settleCommand(item)
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
        ["user", "assistant", "tool", "edit", "command", "notice"].includes(item.kind)
    );
  } catch {
    return [];
  }
}
