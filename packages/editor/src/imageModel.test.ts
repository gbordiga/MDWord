import { describe, expect, it } from "vitest";
import {
  clampImageWidth,
  IMAGE_MAX_BYTES,
  isAllowedImageFile,
  layoutFromMyst,
  mystFromLayout,
  parseWidthPercent,
  widthForLayoutChange
} from "./imageModel";

describe("image model", () => {
  it("parses percent widths", () => {
    expect(parseWidthPercent("40%")).toBe(40);
    expect(parseWidthPercent(0.5)).toBe(50);
    expect(parseWidthPercent(120)).toBe(100);
    expect(clampImageWidth(3)).toBe(10);
  });

  it("maps myst align/class to layout", () => {
    expect(layoutFromMyst("center")).toBe("block-center");
    expect(layoutFromMyst("left")).toBe("block-left");
    expect(layoutFromMyst("left", "float")).toBe("float-left");
    expect(mystFromLayout("float-right")).toEqual({ align: "right", className: "float" });
  });

  it("accepts large camera files that will be compressed on insert", () => {
    expect(isAllowedImageFile({ type: "image/jpeg", size: IMAGE_MAX_BYTES + 1 })).toBe(true);
    expect(isAllowedImageFile({ type: "image/jpeg", size: 25 * 1024 * 1024 })).toBe(false);
  });

  it("suggests a float width", () => {
    expect(widthForLayoutChange(100, "float-left")).toBe(40);
    expect(widthForLayoutChange(40, "block-center")).toBe(100);
    expect(widthForLayoutChange(55, "float-right")).toBe(55);
  });
});
