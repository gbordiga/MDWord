import { describe, expect, it } from "vitest";
import { collectSearchMatches, nextMatchIndex } from "./search";

describe("document search", () => {
  const chunks = [
    { pos: 1, text: "Hello world" },
    { pos: 20, text: "Hello again" }
  ];

  it("finds case-insensitive matches across chunks", () => {
    const matches = collectSearchMatches(chunks, "hello");
    expect(matches).toEqual([
      { from: 1, to: 6 },
      { from: 20, to: 25 }
    ]);
  });

  it("returns nothing for a blank query", () => {
    expect(collectSearchMatches(chunks, "  ")).toEqual([]);
  });

  it("wraps next and previous around the document", () => {
    const matches = collectSearchMatches(chunks, "Hello");
    expect(nextMatchIndex(matches, 2, 1)).toBe(1);
    expect(nextMatchIndex(matches, 26, 1)).toBe(0);
    expect(nextMatchIndex(matches, 20, -1)).toBe(0);
    expect(nextMatchIndex(matches, 1, -1)).toBe(1);
  });
});
