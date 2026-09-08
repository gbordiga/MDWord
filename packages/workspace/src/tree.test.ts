import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  expandFolderPathsForSelection,
  isSameWorkspacePath,
  relativeWorkspacePath,
  workspaceFolderName
} from "./tree";

describe("buildFileTree", () => {
  it("nests desktop-style absolute paths under the open folder", () => {
    const tree = buildFileTree(
      [
        { path: "/notes/drafts", name: "drafts", isDirectory: true },
        { path: "/notes/drafts/idea.md", name: "idea.md", isDirectory: false },
        { path: "/notes/readme.md", name: "readme.md", isDirectory: false },
        { path: "/notes/photo.png", name: "photo.png", isDirectory: false }
      ],
      "/notes"
    );
    expect(tree.map((n) => n.name)).toEqual(["drafts", "photo.png", "readme.md"]);
    expect(tree[0]?.isDirectory).toBe(true);
    expect(tree[0]?.children.map((c) => c.name)).toEqual(["idea.md"]);
    expect(tree[0]?.children[0]?.path).toBe("/notes/drafts/idea.md");
  });

  it("creates intermediate folders when only nested files are listed", () => {
    const tree = buildFileTree(
      [{ path: "/notes/a/b/c.md", name: "c.md", isDirectory: false }],
      "/notes"
    );
    expect(tree[0]?.name).toBe("a");
    expect(tree[0]?.path).toBe("/notes/a");
    expect(tree[0]?.children[0]?.name).toBe("b");
    expect(tree[0]?.children[0]?.path).toBe("/notes/a/b");
    expect(tree[0]?.children[0]?.children[0]?.name).toBe("c.md");
  });

  it("nests web-style paths that start with the folder name", () => {
    const tree = buildFileTree(
      [
        { path: "Project/sub/a.md", name: "a.md", isDirectory: false },
        { path: "Project/b.md", name: "b.md", isDirectory: false },
        { path: "Project/images", name: "images", isDirectory: true },
        { path: "Project/images/logo.png", name: "logo.png", isDirectory: false }
      ],
      "Project"
    );
    expect(tree.map((n) => n.name)).toEqual(["images", "sub", "b.md"]);
    expect(tree.find((n) => n.name === "images")?.children[0]?.name).toBe("logo.png");
  });

  it("keeps windows path separators on derived folder paths", () => {
    const tree = buildFileTree(
      [{ path: "C:\\Users\\me\\Notes\\sub\\a.md", name: "a.md", isDirectory: false }],
      "C:\\Users\\me\\Notes"
    );
    expect(tree[0]?.name).toBe("sub");
    expect(tree[0]?.path).toBe("C:\\Users\\me\\Notes\\sub");
    expect(tree[0]?.children[0]?.path).toBe("C:\\Users\\me\\Notes\\sub\\a.md");
  });

  it("places basename-only saves at the tree root", () => {
    const tree = buildFileTree(
      [{ path: "nuovo.md", name: "nuovo.md", isDirectory: false }],
      "/notes"
    );
    expect(tree.map((n) => n.name)).toEqual(["nuovo.md"]);
  });
});

describe("relativeWorkspacePath", () => {
  it("returns empty for the root itself", () => {
    expect(relativeWorkspacePath("/notes", "/notes")).toBe("");
  });

  it("rejects paths outside the folder", () => {
    expect(relativeWorkspacePath("/other/a.md", "/notes")).toBeNull();
  });
});

describe("selection helpers", () => {
  it("matches the open document and expands ancestor folders", () => {
    const tree = buildFileTree(
      [
        { path: "/notes/drafts/idea.md", name: "idea.md", isDirectory: false },
        { path: "/notes/readme.md", name: "readme.md", isDirectory: false }
      ],
      "/notes"
    );
    expect(isSameWorkspacePath("/notes/drafts/idea.md", "/notes/drafts/idea.md")).toBe(true);
    expect(isSameWorkspacePath("/notes/readme.md", "/notes/drafts/idea.md")).toBe(false);
    expect(expandFolderPathsForSelection(tree, "/notes/drafts/idea.md")).toEqual(["/notes/drafts"]);
  });

  it("uses the last segment of the open folder as the root label", () => {
    expect(workspaceFolderName("/home/me/QMS")).toBe("QMS");
    expect(workspaceFolderName("C:\\Users\\me\\Notes")).toBe("Notes");
  });
});
