import { describe, expect, it } from "vitest";
import { activeMention, filterMentionFiles, mentionedPaths, splitMentions } from "./mentions";

const files = [
  { rel: "notes/ideas.md", title: "Ideas" },
  { rel: "readme.md", title: "Read me" }
];

describe("mentions", () => {
  it("detects an @ token at the caret and filters files", () => {
    expect(activeMention("See @ide", 8)).toEqual({ start: 4, query: "ide" });
    expect(activeMention("email a@b.com", 12)).toBeNull();
    expect(filterMentionFiles(files, "ide").map((f) => f.rel)).toEqual(["notes/ideas.md"]);
  });

  it("splits the draft into plain text and file badges", () => {
    const known = files.map((f) => f.rel);
    const parts = splitMentions("Compare @notes/ideas.md, and @nope.md now", known);
    expect(parts.map((p) => p.text).join("")).toBe("Compare @notes/ideas.md, and @nope.md now");
    expect(parts.filter((p) => p.mention).map((p) => p.text)).toEqual(["@notes/ideas.md"]);
  });

  it("keeps only paths that exist", () => {
    expect(mentionedPaths("Compare @notes/ideas.md and @missing.md.", files.map((f) => f.rel))).toEqual([
      "notes/ideas.md"
    ]);
  });
});