/** Shell execution for the assistant (desktop only). See ADR-011. */

export type ShellName = "bash" | "powershell";

export const SHELL_NAMES: readonly ShellName[] = ["bash", "powershell"];

/** `off` hides the tool. The others are the approval modes. */
export type ShellMode = "off" | "manual" | "ai" | "always";

export const SHELL_DEFAULT_TIMEOUT_MS = 60_000;
export const SHELL_MAX_TIMEOUT_MS = 10 * 60_000;
export const SHELL_MAX_COMMAND_CHARS = 4000;
/** Characters of output kept (the tail) and sent on. */
export const SHELL_MAX_OUTPUT_CHARS = 30_000;

export interface ShellRunRequest {
  id: string;
  shell: ShellName;
  command: string;
  /** Absolute project folder the user opened. The host checks it. */
  root: string;
  /** Folder inside the project, POSIX style. Empty means the root. */
  folder: string;
  timeoutMs: number;
}

export type ShellRunResult =
  | {
      ok: true;
      /** `null` when the process was killed. */
      exitCode: number | null;
      timedOut: boolean;
      cancelled: boolean;
      /** Output was cut: only the tail is kept. */
      truncated: boolean;
      /** Stdout and stderr merged, in memory only. */
      output: string;
      durationMs: number;
      /** Project-relative markdown files that were added, changed or removed. */
      changed: string[];
    }
  | { ok: false; error: "no-shell" | "busy" | "bad-folder" | "bad-root" | "spawn-failed" };

export interface ShellAvailability {
  bash: boolean;
  powershell: boolean;
}

export interface ShellHostApi {
  available(): Promise<ShellAvailability>;
  run(request: ShellRunRequest): Promise<ShellRunResult>;
  cancel(id: string): Promise<void>;
}
