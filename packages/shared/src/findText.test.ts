import { describe, expect, it } from "vitest";
import { DEFAULT_FIND_OPTIONS, compileFind, findInText } from "./findText";

const opts = (o: Partial<typeof DEFAULT_FIND_OPTIONS>) => ({ ...DEFAULT_FIND_OPTIONS, ...o });
const find = (text: string, q: string, o = {}, replace = "") => {
  const c = compileFind(q, opts(o));
  if (!c || !c.ok) throw new Error("no pattern");
  return findInText(text, c.re, replace, Boolean((o as { regex?: boolean }).regex));
};

describe("findText", () => {
  it("ignores case by default and respects it when asked", () => {
    expect(find("Hello hello", "hello")).toHaveLength(2);
    expect(find("Hello hello", "hello", { caseSensitive: true })).toHaveLength(1);
  });

  it("treats plain text literally", () => {
    expect(find("a.b axb", "a.b")).toHaveLength(1);
  });

  it("matches whole words only, also with accents", () => {
    expect(find("cat concat cat.", "cat", { wholeWord: true })).toHaveLength(2);
    expect(find("è perché", "perch", { wholeWord: true })).toHaveLength(0);
  });

  it("supports regular expressions and expands groups in the replacement", () => {
    const [m] = find("2026-11-10", "(\\d+)-(\\d+)-(\\d+)", { regex: true }, "$3/$2/$1");
    expect(m?.replacement).toBe("10/11/2026");
  });

  it("reports an invalid pattern and nothing for a blank query", () => {
    expect(compileFind("(", opts({ regex: true }))).toEqual({ ok: false, error: "Invalid pattern" });
    expect(compileFind("  ", opts({}))).toBeNull();
  });

  it("skips empty matches instead of looping", () => {
    expect(find("abc", "x*", { regex: true })).toEqual([]);
  });
});
