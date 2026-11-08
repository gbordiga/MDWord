import { describe, expect, it } from "vitest";
import { normalizeWorkspacePath } from "./paths";
import { truncateMiddle } from "./truncate";

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

describe("truncateMiddle", () => {
  it("leaves short text alone", () => {
    expect(truncateMiddle("abc", 10)).toMatchObject({ text: "abc", truncated: false });
  });
  it("keeps head and tail and reports the elided count", () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
    const r = truncateMiddle(text, 200);
    expect(r.truncated).toBe(true);
    expect(r.text.startsWith("line 1\n")).toBe(true);
    expect(r.text.endsWith("line 100")).toBe(true);
    expect(r.text).toContain(`${r.elidedChars} characters elided`);
    expect(r.text).toContain("startLine");
  });
});
