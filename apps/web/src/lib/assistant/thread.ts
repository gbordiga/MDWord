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
  | {
      kind: "delete";
      id: string;
      path: string;
      status: "pending" | "deleted" | "kept" | "failed";
      error?: string;
    }
  | { kind: "thought"; id: string; text: string; streaming: boolean }
  | {
      kind: "image";
      id: string;
      alt: string;
      prompt: string;
      /** Set only while the preview is on screen. Never saved. */
      preview?: string;
      /** Image reference id once inserted, such as img-abc. */
      refId?: string;
      path?: string;
      status: "pending" | "inserted" | "discarded" | "failed";
      error?: string;
    }
  | { kind: "notice"; id: string; text: string };

export type ToolItem = Extract<ThreadItem, { kind: "tool" }>;
export type CommandItem = Extract<ThreadItem, { kind: "command" }>;
export type EditItem = Extract<ThreadItem, { kind: "edit" }>;
/** A step inside the work accordion: a tool, a thought, a command that already left the approval card, or an applied edit. */
export type DeleteItem = Extract<ThreadItem, { kind: "delete" }>;
export type ThoughtItem = Extract<ThreadItem, { kind: "thought" }>;
export type WorkEntry = ToolItem | CommandItem | EditItem | DeleteItem | ThoughtItem;
export type ThreadBlock = { kind: "work"; id: string; entries: WorkEntry[] } | { kind: "item"; item: ThreadItem };

/**
 * A command still waiting for Run or Deny stays a card; once it runs, it joins the steps.
 * An edit stays a card while it waits, and when it is discarded or no longer applies;
 * once it is applied to the document, it joins the steps.
 */
function isWorkEntry(item: ThreadItem): item is WorkEntry {
  if (item.kind === "edit") return item.status === "applied";
  if (item.kind === "delete") return item.status !== "pending";
  return item.kind === "tool" || item.kind === "thought" || (item.kind === "command" && item.status !== "pending" && item.status !== "denied");
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
    case "listDocuments":
      return t(name === "listDocuments" ? "tool.listDocuments" : "tool.listFiles", {
        folder: typeof i.folder === "string" && i.folder ? i.folder : t("tool.listFiles.root")
      });
    case "search":
      return t("tool.search", { query: typeof i.query === "string" ? i.query : "" });
    case "readDocument":
      return t("tool.readDocument", { path });
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
    case "deleteFile":
      return t("tool.deleteFile", { path });
    case "generateImage":
      return t("tool.generateImage");
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

function hideStoredPayloads(text: string): string {
  return text.replace(/data:[a-z0-9.+/-]+;base64,[^\s)]+/gi, "data:;base64,[omitted]");
}

export function serializeThread(thread: ThreadItem[]): string {
  const settled = thread
    .slice(-MAX_ITEMS)
    .map((item) =>
      item.kind === "edit"
        ? {
            ...item,
            status: item.status === "pending" ? ("discarded" as const) : item.status,
            edits: item.edits.map((edit) => ({
              ...edit,
              oldText: hideStoredPayloads(edit.oldText),
              newText: hideStoredPayloads(edit.newText)
            }))
          }
        :       item.kind === "delete" && item.status === "pending"
          ? { ...item, status: "kept" as const }
        : item.kind === "thought"
          ? { ...item, streaming: false, text: item.text.slice(0, 12_000) }
        : item.kind === "image"
          ? { ...item, preview: undefined, status: item.status === "pending" ? ("discarded" as const) : item.status }
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
        ["user", "assistant", "tool", "edit", "command", "delete", "thought", "image", "notice"].includes(item.kind)
    );
  } catch {
    return [];
  }
}
