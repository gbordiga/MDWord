import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { applyEdits } from "./edits";

const ok = (source: string, edits: { oldText: string; newText: string }[]) => {
  const r = applyEdits(source, edits);
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe("applyEdits", () => {
  it("replaces one unique match", () => {
    expect(ok("a b c", [{ oldText: "b", newText: "X" }]).result).toBe("a X c");
  });

  it("rejects zero matches with a re-read hint and 'none applied'", () => {
    const r = applyEdits("abc", [{ oldText: "zzz", newText: "x" }]);
    expect(r).toMatchObject({ ok: false, kind: "not-found" });
    if (!r.ok) {
      expect(r.message).toContain("readFile");
      expect(r.message).toContain("No edit was applied");
    }
  });

  it("rejects duplicates and reports the line of each match", () => {
    const r = applyEdits("x\nfoo\ny\nfoo\n", [{ oldText: "foo", newText: "bar" }]);
    expect(r).toMatchObject({ ok: false, kind: "ambiguous" });
    if (!r.ok) {
      expect(r.message).toContain("2 places");
      expect(r.message).toContain("line 2");
      expect(r.message).toContain("line 4");
      expect(r.message).toContain("No edit was applied");
    }
  });

  it("rejects empty oldText and no-op edits", () => {
    expect(applyEdits("abc", [{ oldText: "", newText: "x" }])).toMatchObject({ kind: "empty" });
    expect(applyEdits("abc", [{ oldText: "a", newText: "a" }])).toMatchObject({ kind: "no-change" });
    expect(applyEdits("abc", [])).toMatchObject({ kind: "empty" });
  });

  it("rejects overlapping edits and names both", () => {
    const r = applyEdits("hello world", [
      { oldText: "hello wor", newText: "A" },
      { oldText: "world", newText: "B" }
    ]);
    expect(r).toMatchObject({ ok: false, kind: "overlap" });
    if (!r.ok) expect(r.message).toMatch(/edits\[0\] and edits\[1\]/);
  });

  it("matches against the original and applies from the end", () => {
    const r = ok("one two three", [
      { oldText: "three", newText: "3" },
      { oldText: "one", newText: "1 and two" }
    ]);
    expect(r.result).toBe("1 and two two 3");
    expect(r.edits.map((e) => e.line)).toEqual([1, 1]);
  });

  it("is all-or-nothing", () => {
    const r = applyEdits("a b", [
      { oldText: "a", newText: "x" },
      { oldText: "missing", newText: "y" }
    ]);
    expect(r.ok).toBe(false);
  });

  it("round-trips CRLF and BOM", () => {
    const source = "\uFEFFline1\r\nline2\r\nline3\r\n";
    const r = ok(source, [{ oldText: "line2\nline3", newText: "L2\nL3\nL4" }]);
    expect(r.result).toBe("\uFEFFline1\r\nL2\r\nL3\r\nL4\r\n");
  });

  it("accepts CRLF in oldText from the model", () => {
    const r = ok("a\nb\n", [{ oldText: "a\r\nb", newText: "c" }]);
    expect(r.result).toBe("c\n");
  });

  it("keeps LF files LF", () => {
    expect(ok("a\nb", [{ oldText: "a", newText: "x\ny" }]).result).toBe("x\ny\nb");
  });

  it("handles frontmatter, mdoc, tables and wikilinks as plain text", () => {
    const doc = "---\ntitle: A\n---\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nSee [[Page]].\n";
    expect(ok(doc, [{ oldText: "| 1 | 2 |", newText: "| 1 | 3 |" }]).result).toContain("| 1 | 3 |");
    expect(ok(doc, [{ oldText: "title: A", newText: "title: B" }]).result).toContain("title: B");
    expect(ok(doc, [{ oldText: "[[Page]]", newText: "[[Page|p]]" }]).result).toContain("[[Page|p]]");
  });

  it("property: a unique replacement changes only that region", () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), fc.string(), fc.string(), (pre, mid, post, repl) => {
        fc.pre(!(pre + post).includes(mid) && !(pre + mid).slice(1).includes(mid) && mid !== repl);
        const source = pre + mid + post;
        fc.pre(source.split(mid).length === 2 && !source.includes("\r") && !source.startsWith("\uFEFF"));
        const r = applyEdits(source, [{ oldText: mid, newText: repl }]);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.result).toBe(pre + repl + post);
      })
    );
  });
});
