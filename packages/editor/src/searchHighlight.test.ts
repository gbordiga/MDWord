import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { collectSearchMatches } from "./search";
import { searchHighlightDecorations } from "./searchHighlight";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    text: {}
  }
});

describe("searchHighlightDecorations", () => {
  it("marks every match and flags the current one", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("Alpha and Alpha"))]);
    const matches = collectSearchMatches([{ pos: 1, text: "Alpha and Alpha" }], "Alpha");
    const set = searchHighlightDecorations(doc, matches, 1);
    const found = set.find();
    expect(found).toHaveLength(2);
    expect(found[0]?.from).toBe(matches[0]?.from);
    expect(found[1]?.from).toBe(matches[1]?.from);
  });
});
