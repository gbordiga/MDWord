import { describe, expect, it } from "vitest";
import { isMarkdownFileName, shouldSkipWorkspaceDir, shouldSkipWorkspaceFile } from "./workspaceList";

describe("workspace listing helpers", () => {
  it("treats markdown extensions as openable documents", () => {
    expect(isMarkdownFileName("notes.md")).toBe(true);
    expect(isMarkdownFileName("notes.markdown")).toBe(true);
    expect(isMarkdownFileName("photo.png")).toBe(false);
  });

  it("skips dependency and vcs folders", () => {
    expect(shouldSkipWorkspaceDir("node_modules")).toBe(true);
    expect(shouldSkipWorkspaceDir(".git")).toBe(true);
    expect(shouldSkipWorkspaceDir("drafts")).toBe(false);
    expect(shouldSkipWorkspaceFile(".DS_Store")).toBe(true);
    expect(shouldSkipWorkspaceFile("readme.md")).toBe(false);
  });
});
