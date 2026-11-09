import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ ipcMain: { handle: () => undefined } }));

import { cancelShell, runShell } from "./shell";

const posix = process.platform !== "win32";
const suite = posix ? describe : describe.skip;

suite("runShell (bash)", () => {
  let root = "";
  const roots = () => (candidate: string) => path.resolve(candidate) === root;
  const req = (command: string, extra: Record<string, unknown> = {}) => ({
    id: `t-${Math.random().toString(36).slice(2)}`,
    shell: "bash",
    command,
    root,
    folder: "",
    timeoutMs: 5000,
    ...extra
  });

  beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdword-shell-")));
    fs.mkdirSync(path.join(root, "docs"));
    fs.writeFileSync(path.join(root, "docs", "a.md"), "hello\n");
    process.env.OPENROUTER_API_KEY = "sk-or-v1-should-not-leak";
  });
  afterAll(() => {
    delete process.env.OPENROUTER_API_KEY;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("returns merged output and the exit code", async () => {
    const result = await runShell(req("echo out; echo err 1>&2; exit 3"), roots());
    expect(result).toMatchObject({ ok: true, exitCode: 3, timedOut: false });
    if (result.ok) expect(result.output).toMatch(/out[\s\S]*err|err[\s\S]*out/);
  });

  it("runs in the requested folder", async () => {
    const result = await runShell(req("pwd", { folder: "docs" }), roots());
    expect(result.ok && result.output.trim()).toBe(path.join(root, "docs"));
  });

  it("never passes the key or the app environment to the child", async () => {
    const result = await runShell(req("env"), roots());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).not.toContain("sk-or-v1");
      expect(result.output).not.toContain("OPENROUTER");
    }
  });

  it("refuses a folder outside the project and a root the user did not open", async () => {
    expect(await runShell(req("pwd", { folder: ".." }), roots())).toEqual({ ok: false, error: "bad-folder" });
    expect(await runShell(req("pwd", { folder: "/etc" }), roots())).toEqual({ ok: false, error: "bad-folder" });
    expect(await runShell(req("pwd", { root: os.tmpdir() }), roots())).toEqual({ ok: false, error: "bad-root" });
  });

  it("refuses a folder that is a link to the outside", async () => {
    fs.symlinkSync(os.tmpdir(), path.join(root, "link"));
    expect(await runShell(req("pwd", { folder: "link" }), roots())).toEqual({ ok: false, error: "bad-folder" });
  });

  it("kills the whole tree on timeout", async () => {
    const started = Date.now();
    const result = await runShell(req("sleep 30 & sleep 30", { timeoutMs: 1000 }), roots());
    expect(result).toMatchObject({ ok: true, timedOut: true });
    expect(Date.now() - started).toBeLessThan(8000);
  });

  it("stops on request", async () => {
    const r = req("sleep 30");
    const pending = runShell(r, roots());
    await new Promise((resolve) => setTimeout(resolve, 300));
    cancelShell(r.id);
    expect(await pending).toMatchObject({ ok: true, cancelled: true });
  });

  it("runs several commands at once", async () => {
    const slow = req("sleep 2");
    const first = runShell(slow, roots());
    const second = await runShell(req("echo side"), roots());
    expect(second.ok && second.output).toContain("side");
    cancelShell(slow.id);
    await first;
  });

  it("stops at four commands at once", async () => {
    const holds = Array.from({ length: 4 }, () => req("sleep 5"));
    const pending = holds.map((r) => runShell(r, roots()));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await runShell(req("echo x"), roots())).toEqual({ ok: false, error: "busy" });
    for (const r of holds) cancelShell(r.id);
    await Promise.all(pending);
  });

  it("reads no standard input", async () => {
    const result = await runShell(req("cat"), roots());
    expect(result).toMatchObject({ ok: true, exitCode: 0 });
  });

  it("caps the output and keeps the end", async () => {
    const result = await runShell(req("seq 1 50000"), roots());
    expect(result.ok && result.truncated).toBe(true);
    if (result.ok) {
      expect(result.output).toContain("50000");
      expect(result.output.length).toBeLessThan(31_000);
    }
  });

  it("lists markdown files a command added, changed or removed", async () => {
    const result = await runShell(req("echo x > docs/new.md; echo y >> docs/a.md"), roots());
    expect(result.ok && result.changed).toEqual(["docs/a.md", "docs/new.md"]);
  });
});
