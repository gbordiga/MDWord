import type { Diagnostic } from "@mdword/shared";
import type { AppliedEdit } from "./edits";

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  modifiedMs?: number;
}

export interface SearchResult {
  path: string;
  title: string;
  heading?: string;
  snippet: string;
}

export interface EditProposal {
  /** Unique per proposal; becomes the undo kind `assistant:<id>`. */
  id: string;
  path: string;
  before: string;
  after: string;
  edits: AppliedEdit[];
}

export type EditDecision =
  | { status: "applied" }
  | { status: "rejected" }
  | { status: "stale"; reason: string };

/**
 * Everything the agent may do to the outside world. The host application
 * implements it; the agent package never touches files, the store, or the
 * network directly. Paths are workspace-relative and already validated.
 */
export interface AssistantEnv {
  listFiles(folder: string): Promise<FileEntry[] | null>;
  search(query: string, field: string | undefined, limit: number): Promise<SearchResult[]>;
  /** Buffer of an open tab, else the file on disk. `null` when it does not exist. */
  readFile(path: string): Promise<string | null>;
  diagnostics(source: string): Diagnostic[];
  /** Resolves when the user applies or discards. Must honor the abort signal. */
  proposeEdit(proposal: EditProposal, signal: AbortSignal | undefined): Promise<EditDecision>;
}

export type StopReason =
  | "done"
  | "max-steps"
  | "tool-budget"
  | "spend-cap"
  | "failures"
  | "aborted"
  | "error";

export type TurnEvent =
  | { type: "text"; text: string }
  | { type: "tool-start"; id: string; name: string; input: unknown }
  | { type: "tool-end"; id: string; name: string; ok: boolean; detail?: string }
  | { type: "sources"; sources: { url: string; title?: string }[] }
  | { type: "usage"; inputTokens: number; outputTokens: number; costUsd: number | null }
  | { type: "stop"; reason: StopReason; message?: string };

export interface TurnLimits {
  maxSteps: number;
  maxToolChars: number;
  maxConsecutiveFailures: number;
  /** Abort when the model sends nothing for this long (ms). 0 turns it off. */
  stallMs: number;
}

export const defaultLimits: TurnLimits = {
  maxSteps: 500,
  maxToolChars: 50_000_000,
  maxConsecutiveFailures: 3,
  stallMs: 120_000
};
