import { describe, expect, it, vi } from "vitest";
import { createTools, type ToolContext } from "./tools";
import type { AssistantEnv, DeleteDecision } from "./types";

function setup(decide: (path: string) => Promise<DeleteDecision> | DeleteDecision) {
  const proposeDelete = vi.fn(async (path: string) => decide(path));
  const env = {
    listFiles: async () => [],
    search: async () => [],
    readFile: async () => null,
    diagnostics: () => [],
    canCreateFiles: () => true,
    proposeEdit: async () => ({ status: "rejected" as const }),
    proposeDelete
  } satisfies AssistantEnv;
  const ctx: ToolContext = { env, maxToolChars: 1e9, toolChars: 0, stopReason: null };
  return { tools: createTools(ctx), proposeDelete };
}

type Exec = (input: unknown, options: unknown) => Promise<Record<string, unknown>>;
const exec = (t: unknown, input: unknown) => (t as { execute: Exec }).execute(input, { toolCallId: "x", messages: [] });

describe("deleteFile", () => {
  it("asks the host only for a path inside the project", async () => {
    const { tools, proposeDelete } = setup(async () => ({ status: "deleted" }));
    expect(await exec(tools.deleteFile, { path: "notes/old.md" })).toMatchObject({ ok: true, status: "deleted" });
    expect(proposeDelete).toHaveBeenCalledWith("notes/old.md", undefined);
  });

  it("refuses a path outside the project without asking", async () => {
    const { tools, proposeDelete } = setup(async () => ({ status: "deleted" }));
    for (const path of ["..", "../secret", "/etc/passwd", "C:/Windows", "~/x"]) {
      expect(await exec(tools.deleteFile, { path })).toMatchObject({ ok: false });
    }
    expect(proposeDelete).not.toHaveBeenCalled();
  });

  it("refuses the workspace root and a project with no folder", async () => {
    const { tools, proposeDelete } = setup(async () => ({ status: "deleted" }));
    expect(await exec(tools.deleteFile, { path: "." })).toMatchObject({ ok: false });
    const closed: AssistantEnv = {
      listFiles: async () => [],
      search: async () => [],
      readFile: async () => null,
      diagnostics: () => [],
      canCreateFiles: () => false,
      proposeEdit: async () => ({ status: "rejected" as const }),
      proposeDelete
    };
    const toolsClosed = createTools({ env: closed, maxToolChars: 1e9, toolChars: 0, stopReason: null });
    expect(await exec(toolsClosed.deleteFile, { path: "a.md" })).toMatchObject({ ok: false });
    expect(proposeDelete).not.toHaveBeenCalled();
  });

  it("reports a refusal so the model does not retry", async () => {
    const { tools } = setup(async () => ({ status: "rejected" }));
    const out = await exec(tools.deleteFile, { path: "a.md" });
    expect(out).toMatchObject({ ok: true, status: "rejected" });
    expect(String(out.message)).toMatch(/kept this file/i);
  });

  it("passes a host failure through", async () => {
    const { tools } = setup(async () => ({ status: "failed", reason: "That path is a folder." }));
    expect(await exec(tools.deleteFile, { path: "drafts" })).toMatchObject({
      ok: false,
      error: "That path is a folder."
    });
  });
});
