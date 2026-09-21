import { describe, expect, it } from "vitest";
import {
  emptyDocumentUndo,
  frontmatterUndoKind,
  mdocUndoKind,
  recordDocumentChange,
  redoDocumentChange,
  undoDocumentChange
} from "./documentUndo";

describe("documentUndo", () => {
  it("records patchFrontmatter and patchMdoc as undoable steps", () => {
    let state = emptyDocumentUndo();
    state = recordDocumentChange(state, "s0", "s1", frontmatterUndoKind({ title: "A" }), 1_000);
    state = recordDocumentChange(state, "s1", "s2", mdocUndoKind({ margins: { left: "25mm" } }, { margins: { left: "40mm" } }), 2_000);
    expect(state.past).toEqual(["s0", "s1"]);

    const first = undoDocumentChange(state, "s2");
    expect(first?.source).toBe("s1");
    const second = undoDocumentChange(first!.state, first!.source);
    expect(second?.source).toBe("s0");
    const redone = redoDocumentChange(second!.state, second!.source);
    expect(redone?.source).toBe("s1");
  });

  it("coalesces rapid edits of the same property", () => {
    let state = emptyDocumentUndo();
    state = recordDocumentChange(state, "s0", "s1", "frontmatter:title", 1_000);
    state = recordDocumentChange(state, "s1", "s2", "frontmatter:title", 1_200);
    expect(state.past).toEqual(["s0"]);
    expect(undoDocumentChange(state, "s2")?.source).toBe("s0");
  });

  it("keeps text and property edits as separate steps", () => {
    let state = emptyDocumentUndo();
    state = recordDocumentChange(state, "s0", "s1", "text", 1_000);
    state = recordDocumentChange(state, "s1", "s2", "frontmatter:title", 1_100);
    expect(state.past).toEqual(["s0", "s1"]);
  });
});
