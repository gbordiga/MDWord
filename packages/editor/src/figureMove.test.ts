import { describe, expect, it } from "vitest";
import { mappedInsertAfterDelete } from "./figureMove";

describe("mappedInsertAfterDelete", () => {
  it("shifts the drop point backward when the figure is removed from before it", () => {
    expect(mappedInsertAfterDelete(10, 5, 40)).toBe(35);
  });

  it("keeps a drop before the figure in place", () => {
    expect(mappedInsertAfterDelete(10, 5, 4)).toBe(4);
  });

  it("does not place the figure over itself", () => {
    expect(mappedInsertAfterDelete(10, 5, 12)).toBe(10);
  });
});
