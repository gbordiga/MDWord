import path from "node:path";
import type { ShellName } from "@mdword/shared";

/** Pure helpers for assistant shell execution (ADR-011). No Electron, no I/O. */

/** The only variables a child process inherits. Secrets and the app's own environment stay out. */
const ENV_ALLOW = new Set([
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "USER",
  "USERNAME",
  "LOGNAME",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LANGUAGE",
  "TZ"
]);

const SECRET_NAME = /key|token|secret|passw|credential|auth|cookie|session/i;

export function scrubEnv(source: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value == null) continue;
    const upper = name.toUpperCase();
    if (!(ENV_ALLOW.has(upper) || upper.startsWith("LC_"))) continue;
    if (SECRET_NAME.test(name)) continue;
    out[name] = value;
  }
  out.TERM = "dumb";
  out.NO_COLOR = "1";
  out.CI = "1";
  out.GIT_PAGER = "cat";
  out.PAGER = "cat";
  out.GIT_TERMINAL_PROMPT = "0";
  out.GIT_OPTIONAL_LOCKS = "0";
  return out;
}

/**
 * The folder a command runs in: the project root or a folder inside it.
 * Returns `null` for anything else (absolute paths, `..`, drive letters).
 */
export function resolveFolder(root: string, folder: string): string | null {
  if (root.includes("\0") || folder.includes("\0")) return null;
  if (folder === "") return path.resolve(root);
  if (/^[\\/]/.test(folder) || /^[a-z]:/i.test(folder)) return null;
  if (folder.split(/[\\/]/).includes("..")) return null;
  const base = path.resolve(root);
  const resolved = path.resolve(base, folder);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

/** True when `child` is `root` or inside it (after both are resolved). */
export function isInside(root: string, child: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export interface ShellLaunch {
  file: string;
  args: string[];
}

export function bashCandidates(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  pathExtra: string[] = []
): string[] {
  if (platform !== "win32") return ["/bin/bash", "/usr/bin/bash", ...pathExtra];
  const out: string[] = [];
  for (const base of [env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, "Programs")]) {
    if (base) out.push(path.win32.join(base, "Git", "bin", "bash.exe"));
  }
  const system = (env.SystemRoot ?? env.SYSTEMROOT ?? "C:\\Windows").toLowerCase();
  for (const entry of pathExtra) {
    // `System32\bash.exe` is the WSL launcher: it hangs without a distribution.
    if (path.win32.normalize(entry).toLowerCase().startsWith(system)) continue;
    out.push(entry);
  }
  return out;
}

export function powershellCandidates(platform: NodeJS.Platform, pathExtra: string[] = []): string[] {
  if (platform !== "win32") return [];
  return [...pathExtra];
}

/** `-EncodedCommand` avoids every quoting problem between Node and PowerShell. */
export function powershellArgs(command: string): string[] {
  const script = `[Console]::OutputEncoding=[Text.Encoding]::UTF8;$ProgressPreference='SilentlyContinue';\n${command}`;
  return ["-NoProfile", "-NonInteractive", "-NoLogo", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
}

export function shellArgs(shell: ShellName, command: string): string[] {
  return shell === "bash" ? ["-c", command] : powershellArgs(command);
}

/** Keeps the end of the output, which is where errors and results are. Memory only. */
export class OutputTail {
  private text = "";
  truncated = false;
  constructor(private readonly max: number) {}

  push(chunk: string): void {
    this.text += chunk;
    if (this.text.length > this.max * 2) {
      this.text = this.text.slice(-this.max);
      this.truncated = true;
    }
  }

  value(): string {
    if (this.text.length > this.max) {
      this.truncated = true;
      return `[output cut: showing the last ${this.max} characters]\n${this.text.slice(-this.max)}`;
    }
    return this.truncated ? `[output cut: showing the last part]\n${this.text}` : this.text;
  }
}

export type Snapshot = Map<string, string>;

/** Paths whose entry differs, was added, or is gone. Sorted, capped. */
export function diffSnapshots(before: Snapshot, after: Snapshot, limit = 50): string[] {
  const changed = new Set<string>();
  for (const [file, stamp] of after) if (before.get(file) !== stamp) changed.add(file);
  for (const file of before.keys()) if (!after.has(file)) changed.add(file);
  return [...changed].sort().slice(0, limit);
}
