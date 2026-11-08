import { describe, expect, it } from "vitest";
import { historyFromThread, parseThread, serializeThread, toolLabel, type ThreadItem } from "./thread";

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
});
