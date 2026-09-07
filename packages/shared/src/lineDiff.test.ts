import { describe, expect, it } from "vitest";
import { countLineChanges, diffLines } from "./lineDiff";

describe("diffLines", () => {
  it("marks identical documents as equal", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { kind: "equal", text: "a" },
      { kind: "equal", text: "b" }
    ]);
  });

  it("detects a mid-document insert", () => {
    const changes = diffLines("one\nthree", "one\ntwo\nthree");
    expect(changes).toEqual([
      { kind: "equal", text: "one" },
      { kind: "add", text: "two" },
      { kind: "equal", text: "three" }
    ]);
    expect(countLineChanges(changes)).toEqual({ added: 1, removed: 0 });
  });

  it("detects a replacement", () => {
    const changes = diffLines("hello", "world");
    expect(countLineChanges(changes)).toEqual({ added: 1, removed: 1 });
    expect(changes.map((c) => c.kind).sort()).toEqual(["add", "remove"]);
  });
});
