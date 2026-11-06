import { describe, expect, it } from "vitest";
import { updateNotice } from "./updateNotice";

describe("updateNotice", () => {
  it("stays silent for states that must not interrupt writing", () => {
    expect(updateNotice(null)).toBeNull();
    expect(updateNotice({ state: "idle" })).toBeNull();
    expect(updateNotice({ state: "checking" })).toBeNull();
    expect(updateNotice({ state: "unsupported" })).toBeNull();
  });

  it("shows the download with its version and progress", () => {
    expect(updateNotice({ state: "available", version: "0.2.0" })).toEqual({
      tone: "progress",
      text: "Downloading MDWord 0.2.0…"
    });
    expect(updateNotice({ state: "downloading", version: "0.2.0", percent: 42 })).toEqual({
      tone: "progress",
      text: "Downloading MDWord 0.2.0… 42%"
    });
  });

  it("offers a restart once the update is downloaded", () => {
    expect(updateNotice({ state: "downloaded", version: "0.2.0" })).toEqual({
      tone: "ready",
      text: "MDWord 0.2.0 is ready to install.",
      action: "restart"
    });
  });

  it("confirms a manual check that found nothing", () => {
    expect(updateNotice({ state: "none" })).toEqual({
      tone: "progress",
      text: "MDWord is up to date."
    });
  });

  it("shows a retry for a failed check", () => {
    expect(updateNotice({ state: "error", message: "Could not check for updates." })).toEqual({
      tone: "error",
      text: "Could not check for updates.",
      action: "retry"
    });
  });
});
