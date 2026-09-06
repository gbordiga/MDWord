import { describe, expect, it } from "vitest";
import { normalizeHref } from "./urls";

describe("normalizeHref", () => {
  it("accepts http(s), mailto, and in-document hashes", () => {
    expect(normalizeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeHref(" http://example.com ")).toBe("http://example.com");
    expect(normalizeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(normalizeHref("#section")).toBe("#section");
  });

  it("prefixes bare domains with https", () => {
    expect(normalizeHref("example.com")).toBe("https://example.com");
    expect(normalizeHref("www.example.com/docs")).toBe("https://www.example.com/docs");
  });

  it("rejects empty values and dangerous protocols", () => {
    expect(normalizeHref("")).toBeNull();
    expect(normalizeHref("   ")).toBeNull();
    expect(normalizeHref("javascript:alert(1)")).toBeNull();
    expect(normalizeHref("data:text/html,hi")).toBeNull();
    expect(normalizeHref("//evil.example")).toBeNull();
  });

  it("keeps relative markdown paths", () => {
    expect(normalizeHref("notes.md")).toBe("notes.md");
    expect(normalizeHref("./img.png")).toBe("./img.png");
  });
});
