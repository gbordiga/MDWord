import { describe, expect, it } from "vitest";
import {
  MAX_INSTRUCTION_CHARS,
  MAX_INSTRUCTION_FILES,
  pickInstructionFiles,
  renderInstructions
} from "./instructions";
import { buildSystemPrompt, SYSTEM_PROMPT } from "./prompt";

describe("pickInstructionFiles", () => {
  const files = ["AGENTS.md", "notes/agent.md", "notes/deep/CLAUDE.md", "notes/deep/a.md", "other/AGENTS.md", "readme.md"];

  it("goes from the open file's folder to the root, nearest first", () => {
    expect(pickInstructionFiles(files, "notes/deep/a.md")).toEqual(["notes/deep/CLAUDE.md", "notes/agent.md", "AGENTS.md"]);
    expect(pickInstructionFiles(files, "notes/x.md")).toEqual(["notes/agent.md", "AGENTS.md"]);
  });

  it("uses only the root file when nothing is open, and ignores unrelated folders", () => {
    expect(pickInstructionFiles(files, null)).toEqual(["AGENTS.md"]);
    expect(pickInstructionFiles(files, "other/x.md")).toEqual(["other/AGENTS.md", "AGENTS.md"]);
  });

  it("takes one file per folder by priority and matches names case-insensitively", () => {
    expect(pickInstructionFiles(["claude.md", "Agent.MD", "agents.md"], null)).toEqual(["agents.md"]);
    expect(pickInstructionFiles(["claude.md", "AGENT.md"], null)).toEqual(["AGENT.md"]);
  });

  it("returns nothing without instruction files and caps the count", () => {
    expect(pickInstructionFiles(["a.md", "docs/b.md"], "docs/b.md")).toEqual([]);
    const deep = ["AGENTS.md", "a/AGENTS.md", "a/b/AGENTS.md", "a/b/c/AGENTS.md"];
    expect(pickInstructionFiles(deep, "a/b/c/x.md")).toHaveLength(MAX_INSTRUCTION_FILES);
  });
});

describe("instructions in the system prompt", () => {
  it("adds nothing without files, and the default prompt is unchanged", () => {
    expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
    expect(buildSystemPrompt({ instructions: [{ path: "AGENTS.md", content: "  \n" }] })).toBe(SYSTEM_PROMPT);
  });

  it("labels each file with its path and keeps the safety rules above them", () => {
    const prompt = buildSystemPrompt({
      instructions: [
        { path: "notes/AGENTS.md", content: "Write in formal Italian." },
        { path: "AGENTS.md", content: "Use ISO dates." }
      ]
    });
    expect(prompt.indexOf("# Safety")).toBeLessThan(prompt.indexOf("# Project instructions"));
    expect(prompt).toContain("Instructions from: notes/AGENTS.md\nWrite in formal Italian.");
    expect(prompt.indexOf("notes/AGENTS.md")).toBeLessThan(prompt.indexOf("Instructions from: AGENTS.md"));
    expect(prompt).toContain("never override the Safety and Edit rules");
  });

  it("cuts oversized files with a notice", () => {
    const text = renderInstructions([{ path: "AGENTS.md", content: "x".repeat(MAX_INSTRUCTION_CHARS + 500) }]);
    expect(text).toContain("[Cut:");
    expect(text.length).toBeLessThan(MAX_INSTRUCTION_CHARS + 1500);
  });
});
