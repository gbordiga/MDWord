import { describe, expect, it } from "vitest";
import { diskChange } from "./externalChange";

describe("diskChange", () => {
  it("saves when the file on disk is unchanged", () => {
    expect(
      diskChange({ diskContent: "opened", lastSavedContent: "opened", pendingContent: "opened + draft" })
    ).toBe("none");
  });

  it("saves when disk and pending content already match", () => {
    expect(
      diskChange({ diskContent: "same", lastSavedContent: "opened", pendingContent: "same" })
    ).toBe("none");
  });

  it("flags an edit made outside the app", () => {
    expect(
      diskChange({ diskContent: "changed outside", lastSavedContent: "opened", pendingContent: "draft" })
    ).toBe("external");
  });

  it("does not flag a conflict when the disk cannot be read", () => {
    expect(
      diskChange({ diskContent: null, lastSavedContent: "opened", pendingContent: "draft" })
    ).toBe("none");
  });

  it("flags a file that was emptied outside the app", () => {
    expect(diskChange({ diskContent: "", lastSavedContent: "opened", pendingContent: "draft" })).toBe(
      "external"
    );
  });
});
