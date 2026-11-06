import { describe, expect, it } from "vitest";
import { isRecentFile, rememberRecentFile, sanitizeRecentFiles } from "./recentFiles";

describe("rememberRecentFile", () => {
  it("puts the newest file first and keeps the rest in order", () => {
    expect(rememberRecentFile(["/a.md", "/b.md"], "/c.md")).toEqual(["/c.md", "/a.md", "/b.md"]);
  });

  it("moves an already listed file to the front without duplicating it", () => {
    expect(rememberRecentFile(["/a.md", "/b.md", "/c.md"], "/b.md")).toEqual([
      "/b.md",
      "/a.md",
      "/c.md"
    ]);
  });

  it("treats Windows paths case-insensitively and normalizes separators", () => {
    expect(rememberRecentFile(["C:\\Docs\\A.md"], "c:/docs/a.md")).toEqual(["c:/docs/a.md"]);
  });

  it("keeps POSIX paths that differ only by case", () => {
    expect(rememberRecentFile(["/docs/A.md"], "/docs/a.md")).toEqual(["/docs/a.md", "/docs/A.md"]);
  });

  it("caps the list", () => {
    const list = ["/1.md", "/2.md", "/3.md"];
    expect(rememberRecentFile(list, "/4.md", 2)).toEqual(["/4.md", "/1.md"]);
  });

  it("ignores an empty candidate", () => {
    expect(rememberRecentFile(["/a.md"], "   ")).toEqual(["/a.md"]);
  });
});

describe("isRecentFile", () => {
  it("matches with the same normalization as the list", () => {
    expect(isRecentFile(["C:\\Docs\\A.md"], "c:/docs/a.md")).toBe(true);
    expect(isRecentFile(["/docs/a.md"], "/docs/b.md")).toBe(false);
    expect(isRecentFile(["/docs/a.md"], "")).toBe(false);
  });
});

describe("sanitizeRecentFiles", () => {
  it("keeps only strings, drops duplicates and caps the list", () => {
    expect(sanitizeRecentFiles(["/a.md", 3, null, "/a.md", "/b.md", " ", "/c.md"], 2)).toEqual([
      "/a.md",
      "/b.md"
    ]);
  });

  it("returns an empty list for a value that is not an array", () => {
    expect(sanitizeRecentFiles(undefined)).toEqual([]);
    expect(sanitizeRecentFiles({ 0: "/a.md" })).toEqual([]);
  });
});
