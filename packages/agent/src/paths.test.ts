import { describe, expect, it } from "vitest";
import { normalizeWorkspacePath } from "./paths";

describe("normalizeWorkspacePath", () => {
  it("cleans relative paths", () => {
    expect(normalizeWorkspacePath("./notes//a.md")).toEqual({ ok: true, path: "notes/a.md" });
    expect(normalizeWorkspacePath("notes\\a.md")).toEqual({ ok: true, path: "notes/a.md" });
    expect(normalizeWorkspacePath("")).toEqual({ ok: true, path: "" });
    expect(normalizeWorkspacePath(".")).toEqual({ ok: true, path: "" });
  });
  it.each(["/etc/passwd", "C:\\Windows", "c:/x", "~/x", "../x", "a/../../b", "a/..", "a\0b"])(
    "rejects %j",
    (p) => {
      expect(normalizeWorkspacePath(p).ok).toBe(false);
    }
  );
});

