import { describe, expect, it } from "vitest";
import { isNotAllowedError, isUserAbort } from "./host";

describe("isUserAbort", () => {
  it("treats picker cancel as cancel, not as a fallback reason", () => {
    expect(isUserAbort(Object.assign(new Error("The user aborted a request."), { name: "AbortError" }))).toBe(
      true
    );
    expect(isUserAbort(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }))).toBe(true);
    expect(isUserAbort(new Error("SecurityError"))).toBe(false);
    expect(isUserAbort(undefined)).toBe(false);
  });

  it("distinguishes a write-permission denial from other errors", () => {
    expect(isNotAllowedError(Object.assign(new Error("createWritable"), { name: "NotAllowedError" }))).toBe(true);
    expect(isNotAllowedError(Object.assign(new Error("cancelled"), { name: "AbortError" }))).toBe(false);
  });
});
