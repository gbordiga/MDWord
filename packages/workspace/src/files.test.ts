import { describe, expect, it } from "vitest";
import type { HostApi } from "@mdword/shared";
import { applySavedDocument, isInsideWorkspace, upsertWorkspaceFile } from "./files";
import { loadWorkspace, type WorkspaceState } from "./index";

function emptyWorkspace(root = "/notes"): WorkspaceState {
  return {
    root,
    files: [],
    index: { documents: [] },
    workspaceMdoc: undefined
  };
}

describe("workspace file list", () => {
  it("treats nested paths and basename-only saves as inside the folder", () => {
    expect(isInsideWorkspace("/notes/new.md", "/notes")).toBe(true);
    expect(isInsideWorkspace("/notes/sub/a.md", "/notes")).toBe(true);
    expect(isInsideWorkspace("nuovo.md", "/notes")).toBe(true);
    expect(isInsideWorkspace("/other/x.md", "/notes")).toBe(false);
    expect(isInsideWorkspace("/notes-backup/a.md", "/notes")).toBe(false);
    expect(isInsideWorkspace("/notes/a.md", null)).toBe(false);
  });

  it("inserts a newly saved markdown file into an empty list", () => {
    const next = applySavedDocument(emptyWorkspace(), "/notes/nuovo.md", "# Ciao\n");
    expect(next.files.map((f) => f.name)).toEqual(["nuovo.md"]);
    expect(next.index.documents[0]?.title).toBe("Ciao");
  });

  it("does not duplicate when the same file is saved again with a new title", () => {
    const first = applySavedDocument(emptyWorkspace(), "/notes/a.md", "# Prima\n");
    const second = applySavedDocument(first, "/notes/a.md", "# Seconda\n");
    expect(second.files).toHaveLength(1);
    expect(second.index.documents).toHaveLength(1);
    expect(second.index.documents[0]?.title).toBe("Seconda");
  });

  it("upserts by filename when the web host returns only a basename", () => {
    const seeded: WorkspaceState = {
      ...emptyWorkspace(),
      files: [{ path: "/notes/a.md", name: "a.md", isDirectory: false }]
    };
    const next = applySavedDocument(seeded, "b.md", "# Beta\n");
    expect(next.files.map((f) => f.name).sort()).toEqual(["a.md", "b.md"]);
  });

  it("ignores saves outside the open folder", () => {
    const seeded: WorkspaceState = {
      ...emptyWorkspace(),
      files: [{ path: "/notes/a.md", name: "a.md", isDirectory: false }]
    };
    const next = applySavedDocument(seeded, "/tmp/out.md", "# Nope\n");
    expect(next.files.map((f) => f.name)).toEqual(["a.md"]);
  });

  it("keeps existing files when upserting another", () => {
    const files = upsertWorkspaceFile(
      [{ path: "/notes/a.md", name: "a.md", isDirectory: false }],
      { path: "/notes/b.md", name: "b.md", isDirectory: false }
    );
    expect(files.map((f) => f.name)).toEqual(["a.md", "b.md"]);
  });
});

describe("loadWorkspace", () => {
  it("re-reads the host listing so a file saved after the first load appears", async () => {
    const listing: { path: string; name: string; isDirectory: boolean }[] = [
      { path: "/notes/a.md", name: "a.md", isDirectory: false }
    ];
    const contents = new Map<string, string>([["/notes/a.md", "# A\n"]]);
    const host = {
      files: {
        list: async () => listing.slice(),
        read: async (path: string) => contents.get(path) ?? ""
      }
    } as unknown as HostApi;

    const first = await loadWorkspace(host, "/notes");
    expect(first.files.map((f) => f.name)).toEqual(["a.md"]);

    listing.push({ path: "/notes/b.md", name: "b.md", isDirectory: false });
    contents.set("/notes/b.md", "# B\n");
    const second = await loadWorkspace(host, "/notes");
    expect(second.files.map((f) => f.name)).toEqual(["a.md", "b.md"]);
    expect(second.index.documents.map((d) => d.title).sort()).toEqual(["A", "B"]);
  });
});
