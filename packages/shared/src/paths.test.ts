import { describe, expect, it } from "vitest";
import { normalizeDocPath } from "./paths";

describe("path traversal", () => {
  it("rejects escaping the workspace root", () => {
    expect(() => normalizeDocPath("../etc/passwd")).toThrow();
    expect(() => normalizeDocPath("a/../../secret")).toThrow();
  });
});
