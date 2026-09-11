import { describe, expect, it } from "vitest";
import { formatImageAttrList, parseImageAttrList } from "./imageAttrs";

describe("imageAttrs", () => {
  it("formats and parses a width list", () => {
    expect(formatImageAttrList({ width: 60 })).toBe("{width=60%}");
    expect(parseImageAttrList("{width=60%}")).toEqual({ width: "60%" });
    expect(formatImageAttrList({ width: 100 })).toBe("");
  });

  it("keeps align when it is not center", () => {
    expect(formatImageAttrList({ width: 40, align: "left" })).toBe("{width=40% align=left}");
    expect(parseImageAttrList("width=40% align=left")).toEqual({ width: "40%", align: "left" });
  });
});
