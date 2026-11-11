import { describe, expect, it } from "vitest";
import { groupThread, historyFromThread, parseThread, serializeThread, toolLabel, type ThreadItem } from "./thread";

const thread: ThreadItem[] = [
  { kind: "user", id: "1", text: "fix" },
  { kind: "tool", id: "2", name: "readFile", label: "Reading a.md", status: "running" },
  { kind: "edit", id: "3", path: "a.md", edits: [{ line: 1, oldText: "a", newText: "b" }], status: "pending" },
  { kind: "assistant", id: "4", text: "Done." },
  { kind: "notice", id: "5", text: "Stopped." }
];

describe("assistant thread", () => {
  it("settles unfinished items when saved, so a reload never shows a live card", () => {
    const back = parseThread(serializeThread(thread));
    expect(back.find((i) => i.kind === "edit")).toMatchObject({ status: "discarded" });
    expect(back.find((i) => i.kind === "tool")).toMatchObject({ status: "error" });
  });

  it("rebuilds model history from what was said, never from file text", () => {
    const history = historyFromThread(thread);
    expect(history).toEqual([
      { role: "user", content: "fix" },
      { role: "assistant", content: "Done." }
    ]);
    expect(JSON.stringify(serializeThread(thread))).not.toContain("tool-result");
  });

  it("ignores corrupt or foreign saved data", () => {
    expect(parseThread(null)).toEqual([]);
    expect(parseThread("not json")).toEqual([]);
    expect(parseThread(JSON.stringify({ v: 99, thread: [] }))).toEqual([]);
    expect(parseThread(JSON.stringify({ v: 1, thread: [{ kind: "evil", id: "x" }, { kind: "user", id: "y", text: "ok" }] }))).toHaveLength(1);
  });

  it("labels tools in whole sentences", () => {
    expect(toolLabel("readFile", { path: "a.md", startLine: 2, endLine: 9 })).toBe("Reading a.md, lines 2 to 9");
    expect(toolLabel("listFiles", {})).toBe("Listing files in the workspace");
    expect(toolLabel("search", { query: "tax" })).toBe("Searching for \u201ctax\u201d");
  });

  it("groups consecutive tool steps and keeps everything else apart", () => {
    const tool = (id: string): ThreadItem => ({ kind: "tool", id, name: "readFile", label: id, status: "ok" });
    const blocks = groupThread([
      { kind: "user", id: "u", text: "x" },
      tool("t1"),
      tool("t2"),
      { kind: "edit", id: "e", path: "a.md", edits: [], status: "pending" },
      tool("t3"),
      { kind: "assistant", id: "a", text: "ok" }
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["item", "work", "item", "work", "item"]);
    expect(blocks[1]).toMatchObject({ kind: "work", entries: [{ id: "t1" }, { id: "t2" }] });
    expect(blocks[3]).toMatchObject({ kind: "work", entries: [{ id: "t3" }] });
  });

  it("keeps a thought inside the same steps as the tools around it", () => {
    const blocks = groupThread([
      { kind: "thought", id: "th", text: "Look at the file", streaming: false },
      { kind: "tool", id: "t", name: "readFile", label: "Reading a.md", status: "ok" },
      { kind: "assistant", id: "a", text: "ok" }
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["work", "item"]);
    expect(blocks[0]).toMatchObject({ entries: [{ id: "th" }, { id: "t" }] });
  });

  it("folds an edit into the steps once it is applied, and keeps the other states as cards", () => {
    const edit = (id: string, status: "pending" | "applied" | "discarded" | "stale"): ThreadItem => ({
      kind: "edit",
      id,
      path: "a.md",
      edits: [{ line: 1, oldText: "a", newText: "b" }],
      status
    });
    const blocks = groupThread([
      { kind: "tool", id: "t", name: "editFile", label: "Proposing an edit to a.md", status: "ok" },
      edit("pending", "pending"),
      edit("applied", "applied"),
      edit("discarded", "discarded"),
      edit("stale", "stale")
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["work", "item", "work", "item", "item"]);
    expect(blocks[2]).toMatchObject({ entries: [{ id: "applied" }] });
  });

  it("folds a command into the steps once it is approved, and keeps a pending one as its own card", () => {
    const command = (id: string, status: "pending" | "running" | "done" | "denied"): ThreadItem => ({
      kind: "command",
      id,
      shell: "bash",
      command: "ls",
      folder: "",
      approval: "manual",
      status
    });
    const blocks = groupThread([
      { kind: "tool", id: "t", name: "readFile", label: "Reading a.md", status: "ok" },
      command("pending", "pending"),
      command("running", "running"),
      command("done", "done"),
      command("denied", "denied")
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["work", "item", "work", "item"]);
    expect(blocks[0]).toMatchObject({ entries: [{ id: "t" }] });
    expect(blocks[1]).toMatchObject({ item: { id: "pending" } });
    expect(blocks[2]).toMatchObject({ entries: [{ id: "running" }, { id: "done" }] });
    expect(blocks[3]).toMatchObject({ item: { id: "denied" } });
  });
});

describe("saved commands", () => {
  const base = {
    kind: "command" as const,
    id: "c1",
    shell: "bash" as const,
    command: "ls",
    folder: "",
    approval: "manual" as const
  };

  it("never stores command output", () => {
    const json = serializeThread([
      { ...base, status: "done", exitCode: 0, output: "SECRET FILE TEXT" } as ThreadItem
    ]);
    expect(json).not.toContain("SECRET FILE TEXT");
    expect(parseThread(json)[0]).toMatchObject({ kind: "command", command: "ls", exitCode: 0, status: "done" });
  });

  it("closes a command that never finished", () => {
    const [pending, running] = parseThread(
      serializeThread([{ ...base, status: "pending" }, { ...base, id: "c2", status: "running" }] as ThreadItem[])
    );
    expect(pending).toMatchObject({ status: "denied" });
    expect(running).toMatchObject({ status: "failed" });
  });

  it("leaves commands out of the model history", () => {
    expect(historyFromThread([{ ...base, status: "done" } as ThreadItem])).toEqual([]);
  });
});
