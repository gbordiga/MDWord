import { describe, expect, it } from "vitest";
import { activeMention, filterMentionFiles, folderListing, isFolderMention, mentionedPaths, splitMentions } from "./mentions";

const files = [
  { rel: "notes/ideas.md", title: "Ideas" },
  { rel: "readme.md", title: "Read me" }
];

describe("mentions", () => {
  it("detects an @ token at the caret and filters files", () => {
    expect(activeMention("See @ide", 8)).toEqual({ start: 4, end: 8, query: "ide" });
    expect(activeMention("See @notes.md ok", 7)).toEqual({ start: 4, end: 13, query: "no" });
    expect(activeMention("email a@b.com", 12)).toBeNull();
    expect(filterMentionFiles(files, "ide").map((f) => f.rel)).toEqual(["notes/ideas.md"]);
  });

  it("splits the draft into plain text and file badges", () => {
    const known = files.map((f) => f.rel);
    const parts = splitMentions("Compare @notes/ideas.md, and @nope.md now", known);
    expect(parts.map((p) => p.text).join("")).toBe("Compare @notes/ideas.md, and @nope.md now");
    expect(parts.filter((p) => p.mention).map((p) => p.text)).toEqual(["@notes/ideas.md"]);
  });

  it("recognizes paths with spaces and prefers the longest name", () => {
    const known = ["notes (2).md", "notes.md", "a.md", "a.md.bak"];
    expect(mentionedPaths("Use @notes (2).md and @notes.md.", known)).toEqual(["notes (2).md", "notes.md"]);
    expect(mentionedPaths("See @a.md.bak", known)).toEqual(["a.md.bak"]);
    expect(splitMentions("x @notes (2).md y", known).filter((p) => p.mention).map((p) => p.text)).toEqual([
      "@notes (2).md"
    ]);
    expect(mentionedPaths("mail me@a.md", known)).toEqual([]);
  });

  it("lists folders first and recognizes a folder next to the files inside it", () => {
    const withFolders = [{ rel: "notes/", title: "notes/" }, ...files];
    expect(filterMentionFiles(withFolders, "notes").map((f) => f.rel)).toEqual(["notes/", "notes/ideas.md"]);
    expect(isFolderMention("notes/")).toBe(true);
    expect(isFolderMention("notes/ideas.md")).toBe(false);
    const known = withFolders.map((f) => f.rel);
    expect(mentionedPaths("Look in @notes/ and @notes/ideas.md.", known)).toEqual(["notes/", "notes/ideas.md"]);
    expect(splitMentions("Look in @notes/ now", known).filter((p) => p.mention).map((p) => p.text)).toEqual(["@notes/"]);
  });

  it("caps folders in the menu and notes a cut folder listing", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ rel: `d${i}/`, title: `d${i}/` }));
    const out = filterMentionFiles([...many, ...files], "").map((f) => f.rel);
    expect(out.slice(0, 5)).toEqual(["d0/", "d1/", "d2/", "d3/", "d4/"]);
    expect(out).toContain("readme.md");
    expect(folderListing("a/", ["a/1.md", "a/2.md", "b/3.md"], 1)).toBe(
      "a/1.md\n(1 more files not listed; use listDocuments or search)"
    );
    expect(folderListing("z/", ["a/1.md"])).toBe("(no files)");
  });

  it("keeps only paths that exist", () => {
    expect(mentionedPaths("Compare @notes/ideas.md and @missing.md.", files.map((f) => f.rel))).toEqual([
      "notes/ideas.md"
    ]);
  });
});