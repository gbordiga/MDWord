import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { z } from "zod";
import {
  SHELL_MAX_COMMAND_CHARS,
  SHELL_MAX_OUTPUT_CHARS,
  SHELL_MAX_TIMEOUT_MS,
  type ShellAvailability,
  type ShellName,
  type ShellRunResult
} from "@mdword/shared";
import {
  OutputTail,
  bashCandidates,
  diffSnapshots,
  isInside,
  powershellCandidates,
  resolveFolder,
  scrubEnv,
  shellArgs,
  type Snapshot
} from "./shellCore";

/**
 * Runs the assistant's shell commands (ADR-011). Only this module spawns them.
 * The renderer asks over IPC; this side re-checks the project folder, builds
 * the environment, enforces the limits and kills the whole process tree.
 */

const MARKDOWN = /\.(md|markdown|mdown|mkd)$/i;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const MAX_SNAPSHOT_FILES = 5000;
const MAX_SNAPSHOT_DEPTH = 8;

const requestSchema = z.object({
  id: z.string().min(1).max(64),
  shell: z.enum(["bash", "powershell"]),
  command: z.string().min(1).max(SHELL_MAX_COMMAND_CHARS),
  root: z.string().min(1).max(4096),
  folder: z.string().max(1024),
  timeoutMs: z.number().int().min(1000).max(SHELL_MAX_TIMEOUT_MS)
});

async function executable(file: string): Promise<boolean> {
  try {
    await fs.access(file, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

function pathEntries(names: string[]): string[] {
  const dirs = (process.env.PATH ?? process.env.Path ?? "").split(path.delimiter).filter(Boolean);
  const out: string[] = [];
  // Name first: `pwsh` beats `powershell` whatever the order of PATH.
  for (const name of names) for (const dir of dirs) out.push(path.join(dir, name));
  return out;
}

const cache = new Map<ShellName, string | null>();

async function findShell(shell: ShellName): Promise<string | null> {
  if (cache.has(shell)) return cache.get(shell) ?? null;
  const win = process.platform === "win32";
  const candidates =
    shell === "bash"
      ? bashCandidates(process.platform, process.env, pathEntries(win ? ["bash.exe"] : ["bash"]))
      : powershellCandidates(process.platform, pathEntries(["pwsh.exe", "powershell.exe"]));
  if (shell === "powershell" && !win) {
    // PowerShell 7 can be installed elsewhere; look for `pwsh` on PATH.
    candidates.push(...pathEntries(["pwsh"]));
  }
  let found: string | null = null;
  for (const candidate of candidates) {
    if (await executable(candidate)) {
      found = candidate;
      break;
    }
  }
  if (found) cache.set(shell, found);
  return found;
}

/** Markdown files under `folder`: path to `mtime:size`. Bounded; unreadable entries are skipped. */
async function snapshot(root: string): Promise<Snapshot> {
  const out: Snapshot = new Map();
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_SNAPSHOT_DEPTH || out.size >= MAX_SNAPSHOT_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.size >= MAX_SNAPSHOT_FILES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) await walk(full, depth + 1);
      } else if (entry.isFile() && MARKDOWN.test(entry.name)) {
        try {
          const stat = await fs.stat(full);
          out.set(path.relative(root, full).split(path.sep).join("/"), `${Math.round(stat.mtimeMs)}:${stat.size}`);
        } catch {
          /* gone while scanning */
        }
      }
    }
  };
  await walk(root, 0);
  return out;
}

function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid == null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => child.kill());
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

let running: { id: string; cancel: () => void } | null = null;

export async function runShell(
  raw: unknown,
  isProjectRoot: (root: string) => boolean
): Promise<ShellRunResult> {
  const req = requestSchema.parse(raw);
  const root = path.resolve(req.root);
  if (!isProjectRoot(root)) return { ok: false, error: "bad-root" };
  const cwd = resolveFolder(root, req.folder);
  if (!cwd || !isInside(root, cwd)) return { ok: false, error: "bad-folder" };
  try {
    // A link inside the project must not lead the command outside it.
    const real = await fs.realpath(cwd);
    const realRoot = await fs.realpath(root);
    if (!isInside(realRoot, real)) return { ok: false, error: "bad-folder" };
  } catch {
    return { ok: false, error: "bad-folder" };
  }
  // Reserve synchronously, before any await: two calls in the same turn must not both pass.
  if (running) return { ok: false, error: "busy" };
  let child: ChildProcess | null = null;
  let timedOut = false;
  let cancelled = false;
  const slot = {
    id: req.id,
    cancel: () => {
      cancelled = true;
      if (child) killTree(child);
    }
  };
  running = slot;
  const file = await findShell(req.shell);
  if (!file) {
    if (running === slot) running = null;
    return { ok: false, error: "no-shell" };
  }
  if (cancelled) {
    if (running === slot) running = null;
    return { ok: true, exitCode: null, timedOut: false, cancelled: true, truncated: false, output: "", durationMs: 0, changed: [] };
  }

  const before = await snapshot(root);
  const started = Date.now();
  const tail = new OutputTail(SHELL_MAX_OUTPUT_CHARS);

  return new Promise<ShellRunResult>((resolve) => {
    if (cancelled) {
      if (running === slot) running = null;
      resolve({ ok: true, exitCode: null, timedOut: false, cancelled: true, truncated: false, output: "", durationMs: 0, changed: [] });
      return;
    }
    try {
      child = spawn(file, shellArgs(req.shell, req.command), {
        cwd,
        env: scrubEnv(process.env),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32"
      });
    } catch {
      if (running === slot) running = null;
      resolve({ ok: false, error: "spawn-failed" });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      if (child) killTree(child);
    }, req.timeoutMs);

    const decoders = [new TextDecoder("utf-8"), new TextDecoder("utf-8")];
    child.stdout?.on("data", (chunk: Buffer) => tail.push(decoders[0]!.decode(chunk, { stream: true })));
    child.stderr?.on("data", (chunk: Buffer) => tail.push(decoders[1]!.decode(chunk, { stream: true })));

    let settled = false;
    const finish = async (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const decoder of decoders) tail.push(decoder.decode());
      const output = tail.value();
      const after = await snapshot(root);
      if (running === slot) running = null;
      resolve({
        ok: true,
        exitCode,
        timedOut,
        cancelled,
        truncated: tail.truncated,
        output,
        durationMs: Date.now() - started,
        changed: diffSnapshots(before, after)
      });
    };
    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (running === slot) running = null;
      resolve({ ok: false, error: "spawn-failed" });
    });
    child.on("close", (code) => void finish(code));
  });
}

export function cancelShell(id: string): void {
  if (running?.id === id) running.cancel();
}

export async function shellAvailability(): Promise<ShellAvailability> {
  return {
    bash: (await findShell("bash")) != null,
    powershell: (await findShell("powershell")) != null
  };
}

/** Kill a running command when the app is closing. */
export function killRunningShell(): void {
  running?.cancel();
}

export function registerShellIpc(isProjectRoot: (root: string) => boolean): void {
  ipcMain.handle("assistant.shell.available", () => shellAvailability());
  ipcMain.handle("assistant.shell.run", (_e, payload: unknown) => runShell(payload, isProjectRoot));
  ipcMain.handle("assistant.shell.cancel", (_e, id: unknown) => {
    cancelShell(z.string().max(64).parse(id));
  });
}
