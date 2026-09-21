import { describe, expect, it } from "vitest";
import { normalizeDocPath, resolveExternalImagePath } from "./paths";

describe("path traversal", () => {
  it("rejects escaping the workspace root", () => {
    expect(() => normalizeDocPath("../etc/passwd")).toThrow();
    expect(() => normalizeDocPath("a/../../secret")).toThrow();
  });
});

describe("resolveExternalImagePath", () => {
  it("resolves a relative image next to the document", () => {
    expect(resolveExternalImagePath("photos/cat.png", "/notes/readme.md", "/notes")).toBe(
      "/notes/photos/cat.png"
    );
  });

  it("keeps absolute and file URL paths", () => {
    expect(resolveExternalImagePath("/notes/cat.png", "/notes/a.md")).toBe("/notes/cat.png");
    expect(resolveExternalImagePath("file:///C:/vault/pic.png", null)).toBe("C:/vault/pic.png");
  });

  it("skips http(s) and empty sources", () => {
    expect(resolveExternalImagePath("https://example.com/a.png", "/notes/a.md")).toBeNull();
    expect(resolveExternalImagePath("", "/notes/a.md")).toBeNull();
  });
});
