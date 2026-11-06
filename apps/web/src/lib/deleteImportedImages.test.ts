import { beforeEach, describe, expect, it, vi } from "vitest";

type HostState = {
  removed: string[];
  prepared: string[];
  existing: Set<string>;
  failFor: Set<string>;
};

const host = vi.hoisted(() => ({
  removed: [] as string[],
  prepared: [] as string[],
  existing: new Set<string>(),
  failFor: new Set<string>()
}));

vi.mock("./host", () => ({
  getHost: () => ({
    files: {
      prepareWrite: async (path: string) => {
        host.prepared.push(path);
      },
      remove: async (path: string) => {
        if (host.failFor.has(path)) throw new Error("permission denied");
        host.removed.push(path);
        host.existing.delete(path);
      },
      exists: async (path: string) => host.existing.has(path)
    }
  })
}));

const { deleteImportedImageFiles } = await import("./importDocumentImages");

function reset(state: Partial<HostState> = {}) {
  host.removed.length = 0;
  host.prepared.length = 0;
  host.existing = new Set(state.existing ?? []);
  host.failFor = new Set(state.failFor ?? []);
}

describe("deleteImportedImageFiles", () => {
  beforeEach(() => reset());

  it("deletes each path once and reports what was removed", async () => {
    reset({ existing: new Set(["/notes/a.png", "/notes/b.png"]) });

    const result = await deleteImportedImageFiles(["/notes/a.png", "/notes/b.png", "/notes/a.png"]);

    expect(result).toEqual({ deleted: ["/notes/a.png", "/notes/b.png"], failed: [] });
    expect(host.removed).toEqual(["/notes/a.png", "/notes/b.png"]);
    expect(host.prepared).toEqual(["/notes/a.png", "/notes/b.png"]);
  });

  it("treats a file that is already gone as deleted", async () => {
    reset({ failFor: new Set(["/notes/gone.png"]) });

    const result = await deleteImportedImageFiles(["/notes/gone.png"]);

    expect(result).toEqual({ deleted: ["/notes/gone.png"], failed: [] });
  });

  it("reports files that are still on disk", async () => {
    reset({
      existing: new Set(["/notes/locked.png", "/notes/ok.png"]),
      failFor: new Set(["/notes/locked.png"])
    });

    const result = await deleteImportedImageFiles(["/notes/locked.png", "/notes/ok.png"]);

    expect(result).toEqual({ deleted: ["/notes/ok.png"], failed: ["/notes/locked.png"] });
  });
});
