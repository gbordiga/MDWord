import { describe, expect, it } from "vitest";
import { isNativeApp } from "./native";

describe("native detection", () => {
  it("is false in Node and the browser test runner", () => {
    expect(isNativeApp()).toBe(false);
  });
});
