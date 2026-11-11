import type { Diagnostic, ShellName } from "@mdword/shared";
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
  /** The path does not exist yet. Apply creates the file instead of patching it. */
  create?: boolean;
}

export type EditDecision =
  | { status: "applied" }
  | { status: "rejected" }
  | { status: "stale"; reason: string };

/** Deleting a file always waits for the user. Automatic edit approval does not apply. */
export type DeleteDecision =
  | { status: "deleted" }
  | { status: "rejected" }
  | { status: "failed"; reason: string };

export interface CommandRequest {
  shell: ShellName;
  command: string;
  /** Folder inside the workspace. Empty for the root. */
  folder: string;
  timeoutMs: number;
  /** Reserved. Automatic modes are not forced back to manual for ordinary reads or web search. */
  tainted: boolean;
}

export type CommandOutcome =
  | { status: "denied" }
  | {
      status: "ran";
      exitCode: number | null;
      timedOut: boolean;
      cancelled: boolean;
      truncated: boolean;
      output: string;
      durationMs: number;
      changed: string[];
    }
  | { status: "failed"; reason: string };

/**
 * Everything the agent may do to the outside world. The host application
 * implements it; the agent package never touches files, the store, or the
 * network directly. Paths are workspace-relative and already validated.
 */
export interface AssistantEnv {
  listFiles(folder: string): Promise<FileEntry[] | null>;
  /**
   * One folder level of docx, pptx, xlsx, and pdf, plus subfolders.
   * Absent hosts cannot offer the tool.
   */
  listDocuments?(folder: string): Promise<FileEntry[] | null>;
  search(query: string, field: string | undefined, limit: number): Promise<SearchResult[]>;
  /** Buffer of an open tab, else the file on disk. `null` when it does not exist. */
  readFile(path: string): Promise<string | null>;
  /**
   * Extract a docx, pptx, xlsx, or pdf file inside the project as Markdown.
   * `null` when the file does not exist. Absent hosts cannot offer the tool.
   */
  readDocument?(path: string): Promise<string | null>;
  /**
   * Generate one image, ask the user, and on acceptance embed it in the open
   * document. The returned message never contains image bytes.
   */
  generateImage?(prompt: string, alt: string, signal: AbortSignal | undefined): Promise<
    | { status: "inserted"; path: string; id: string }
    | { status: "rejected" }
    | { status: "failed"; reason: string }
  >;
  diagnostics(source: string): Diagnostic[];
  /** False when there is no folder to create files in (only open tabs). */
  canCreateFiles(): boolean;
  /** Resolves when the user applies or discards. Must honor the abort signal. */
  proposeEdit(proposal: EditProposal, signal: AbortSignal | undefined): Promise<EditDecision>;
  /**
   * Ask the user before removing one file inside the project. The host refuses
   * anything outside the workspace, a folder, or a missing path, and never
   * applies this without an explicit confirmation.
   */
  proposeDelete(path: string, signal: AbortSignal | undefined): Promise<DeleteDecision>;
  /**
   * Whether the user opened or named this file. Reading any other file marks the
   * turn as tainted for the automatic approval modes. Missing means "not trusted".
   */
  isTrustedPath?(path: string): boolean;
  /**
   * Desktop only, and only when the user turned commands on for this workspace.
   * When absent the model is not offered `runCommand`. The host owns approval,
   * execution limits, and the rule that automatic modes never approve a tainted turn.
   */
  runCommand?(request: CommandRequest, signal: AbortSignal | undefined): Promise<CommandOutcome>;
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
  | { type: "reasoning"; text: string }
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
