import { describe, expect, it, vi } from "vitest";
import { createTools, type ToolContext } from "./tools";
import { buildSystemPrompt } from "./prompt";
import type { AssistantEnv, CommandOutcome, CommandRequest } from "./types";

function setup(overrides: Partial<AssistantEnv> = {}, files: Record<string, string> = { "a.md": "A", "b.md": "B" }) {
  const runCommand = vi.fn(
    async (_req: CommandRequest): Promise<CommandOutcome> => ({
      status: "ran",
      exitCode: 0,
      timedOut: false,
      cancelled: false,
      truncated: false,
      output: "ok",
      durationMs: 5,
      changed: []
    })
  );
  const env = {
    listFiles: async () => [],
    search: async () => Object.keys(files).map((path) => ({ path, title: path, snippet: files[path]! })),
    readFile: async (p: string) => files[p] ?? null,
    diagnostics: () => [],
    canCreateFiles: () => true,
    proposeEdit: async () => ({ status: "rejected" as const }),
    isTrustedPath: (p: string) => p === "a.md",
    runCommand,
    ...overrides
  } satisfies AssistantEnv;
  const ctx: ToolContext = { env, maxToolChars: 1e9, toolChars: 0, stopReason: null };
  return { ctx, tools: createTools(ctx), runCommand };
}

type Exec = (input: unknown, options: unknown) => Promise<Record<string, unknown>>;
const exec = (t: unknown, input: unknown) => (t as { execute: Exec }).execute(input, { toolCallId: "x", messages: [] });

describe("runCommand tool", () => {
  it("is offered only when the host provides it", () => {
    expect("runCommand" in setup().tools).toBe(true);
    expect("runCommand" in setup({ runCommand: undefined }).tools).toBe(false);
    expect(buildSystemPrompt({ shell: true })).toContain("# Commands");
    expect(buildSystemPrompt({})).not.toContain("# Commands");
  });

  it("passes the shell, a checked folder, a timeout and the taint flag", async () => {
    const { tools, runCommand } = setup();
    const out = await exec(tools.runCommand, { shell: "bash", command: "ls", folder: "docs", timeoutSeconds: 5 });
    expect(out).toMatchObject({ ok: true, status: "ran", exitCode: 0, output: "ok" });
    expect(runCommand).toHaveBeenCalledWith(
      { shell: "bash", command: "ls", folder: "docs", timeoutMs: 5000, tainted: false },
      undefined
    );
  });

  it("refuses a folder outside the workspace without asking the host", async () => {
    const { tools, runCommand } = setup();
    for (const folder of ["..", "../x", "/etc", "C:/x"]) {
      expect(await exec(tools.runCommand, { shell: "bash", command: "ls", folder })).toMatchObject({ ok: false });
    }
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("reports a denial so the model does not retry", async () => {
    const { tools } = setup({ runCommand: async () => ({ status: "denied" }) });
    const out = await exec(tools.runCommand, { shell: "bash", command: "ls" });
    expect(out).toMatchObject({ ok: true, status: "denied" });
    expect(String(out.message)).toMatch(/not run it again/i);
  });

  it("turns a host failure into a tool error", async () => {
    const { tools } = setup({ runCommand: async () => ({ status: "failed", reason: "No shell" }) });
    expect(await exec(tools.runCommand, { shell: "bash", command: "ls" })).toEqual({ ok: false, error: "No shell" });
  });

  it("does not force approval because a file was read or searched", async () => {
    const { tools, ctx, runCommand } = setup();
    await exec(tools.readFile, { path: "b.md" });
    await exec(tools.search, { query: "x" });
    await exec(tools.runCommand, { shell: "bash", command: "ls" });
    expect(ctx.tainted).toBeFalsy();
    expect(runCommand.mock.calls[0]![0].tainted).toBe(false);
  });
});
