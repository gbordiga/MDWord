import { describe, expect, it } from "vitest";
import {
  childNamesInFolder,
  isPathOrDescendant,
  isValidWorkspaceEntryName,
  joinWorkspacePath,
  normalizeNewFileName,
  rewriteWorkspacePath,
  targetFolderPath,
  uniqueChildName,
  workspaceParentPath
} from "./mutations";

describe("joinWorkspacePath", () => {
  it("keeps POSIX roots", () => {
    expect(joinWorkspacePath("/notes", "drafts", "a.md")).toBe("/notes/drafts/a.md");
  });

  it("keeps Windows separators", () => {
    expect(joinWorkspacePath("C:\\Users\\me\\Notes", "sub", "a.md")).toBe(
      "C:\\Users\\me\\Notes\\sub\\a.md"
    );
  });

  it("joins web-style folder names", () => {
    expect(joinWorkspacePath("Project", "sub", "a.md")).toBe("Project/sub/a.md");
  });
});

describe("workspaceParentPath", () => {
  it("returns the root for top-level files", () => {
    expect(workspaceParentPath("/notes/a.md", "/notes")).toBe("/notes");
  });

  it("returns the parent folder for nested Windows files", () => {
    expect(workspaceParentPath("C:\\Notes\\sub\\a.md", "C:\\Notes")).toBe("C:\\Notes\\sub");
  });
});

describe("uniqueChildName", () => {
  it("returns the wanted name when free", () => {
    expect(uniqueChildName(["readme.md"], "Untitled.md")).toBe("Untitled.md");
  });

  it("adds a numeric suffix before the extension", () => {
    expect(uniqueChildName(["Untitled.md"], "Untitled.md")).toBe("Untitled (2).md");
    expect(uniqueChildName(["Untitled.md", "Untitled (2).md"], "Untitled.md")).toBe(
      "Untitled (3).md"
    );
  });

  it("suffixes folders without an extension", () => {
    expect(uniqueChildName(["New folder"], "New folder")).toBe("New folder (2)");
  });
});

describe("childNamesInFolder", () => {
  const files = [
    { path: "/notes/drafts", name: "drafts" },
    { path: "/notes/drafts/idea.md", name: "idea.md" },
    { path: "/notes/readme.md", name: "readme.md" }
  ];

  it("lists only direct children of the root", () => {
    expect(childNamesInFolder(files, "/notes", "/notes").sort()).toEqual(["drafts", "readme.md"]);
  });

  it("lists only direct children of a nested folder", () => {
    expect(childNamesInFolder(files, "/notes/drafts", "/notes")).toEqual(["idea.md"]);
  });
});

describe("name helpers", () => {
  it("rejects empty and reserved names", () => {
    expect(isValidWorkspaceEntryName("")).toBe(false);
    expect(isValidWorkspaceEntryName("..")).toBe(false);
    expect(isValidWorkspaceEntryName("a/b")).toBe(false);
    expect(isValidWorkspaceEntryName("ok.md")).toBe(true);
  });

  it("adds .md when no extension is present", () => {
    expect(normalizeNewFileName("notes")).toBe("notes.md");
    expect(normalizeNewFileName("notes.md")).toBe("notes.md");
    expect(normalizeNewFileName("photo.png")).toBe("photo.png");
  });

  it("uses a file's parent as the create target", () => {
    expect(targetFolderPath({ path: "/notes/a.md", isDirectory: false }, "/notes")).toBe("/notes");
    expect(targetFolderPath({ path: "/notes/drafts", isDirectory: true }, "/notes")).toBe(
      "/notes/drafts"
    );
  });

  it("rewrites the open path when a folder is renamed", () => {
    expect(rewriteWorkspacePath("/notes/sub/a.md", "/notes/sub", "/notes/renamed")).toBe(
      "/notes/renamed/a.md"
    );
    expect(rewriteWorkspacePath("C:\\Notes\\sub\\a.md", "C:\\Notes\\sub", "C:\\Notes\\renamed")).toBe(
      "C:\\Notes\\renamed\\a.md"
    );
    expect(rewriteWorkspacePath("/notes/other.md", "/notes/sub", "/notes/renamed")).toBe(
      "/notes/other.md"
    );
  });

  it("detects a path inside a deleted folder", () => {
    expect(isPathOrDescendant("/notes/sub/a.md", "/notes/sub")).toBe(true);
    expect(isPathOrDescendant("/notes/sub", "/notes/sub")).toBe(true);
    expect(isPathOrDescendant("/notes/other.md", "/notes/sub")).toBe(false);
  });
});
