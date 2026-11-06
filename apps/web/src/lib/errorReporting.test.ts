import { describe, expect, it, vi } from "vitest";
import type { DiagnosticsBundle } from "@mdword/shared";
import {
  capturedErrors,
  describeError,
  installErrorCapture,
  isBenignError,
  recordCapturedError,
  resetCapturedErrors
} from "./errorReporting";
import { buildDiagnostics } from "./diagnostics";

describe("isBenignError", () => {
  it("ignores cancelled pickers and aborted captures", () => {
    expect(isBenignError(Object.assign(new Error("cancelled"), { name: "AbortError" }))).toBe(true);
    expect(isBenignError(Object.assign(new Error("denied"), { name: "NotAllowedError" }))).toBe(true);
    expect(isBenignError("The user aborted a request.")).toBe(true);
    expect(isBenignError(new Error("ResizeObserver loop completed with undelivered notifications."))).toBe(
      true
    );
  });

  it("does not ignore real failures", () => {
    expect(isBenignError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isBenignError(new TypeError("boom"))).toBe(false);
  });
});

describe("describeError", () => {
  it("flattens messages to one bounded line", () => {
    const long = `line one\nline two ${"x".repeat(400)}`;
    const described = describeError(new Error(long));
    expect(described.kind).toBe("Error");
    expect(described.message).not.toContain("\n");
    expect(described.message.length).toBeLessThanOrEqual(241);
  });

  it("understands strings, numbers and plain objects", () => {
    expect(describeError("plain failure")).toEqual({ kind: "Error", message: "plain failure" });
    expect(describeError(42)).toEqual({ kind: "Error", message: "42" });
    expect(describeError({ name: "CustomError", message: "from a worker" })).toEqual({
      kind: "CustomError",
      message: "from a worker"
    });
  });
});

describe("captured errors", () => {
  it("keeps the newest entries and skips benign failures", () => {
    resetCapturedErrors();
    expect(recordCapturedError("test", Object.assign(new Error("x"), { name: "AbortError" }))).toBeNull();
    for (let i = 0; i < 25; i++) recordCapturedError("test", new Error(`failure ${i}`));
    const entries = capturedErrors();
    expect(entries).toHaveLength(20);
    expect(entries[0]?.message).toBe("failure 5");
    expect(entries[19]?.message).toBe("failure 24");
    resetCapturedErrors();
  });
});

describe("installErrorCapture", () => {
  function fakeTarget() {
    const listeners = new Map<string, (event: unknown) => void>();
    return {
      listeners,
      addEventListener(type: string, listener: (event: never) => void) {
        listeners.set(type, listener as (event: unknown) => void);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      }
    };
  }

  it("reports window errors and rejections, and stops after cleanup", () => {
    resetCapturedErrors();
    const target = fakeTarget();
    const seen: string[] = [];
    const stop = installErrorCapture((entry) => seen.push(entry.message), target);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      target.listeners.get("error")?.({ error: new Error("render failed") });
      target.listeners.get("unhandledrejection")?.({ reason: new TypeError("promise failed") });
      target.listeners.get("unhandledrejection")?.({
        reason: Object.assign(new Error("cancelled"), { name: "AbortError" })
      });

      expect(seen).toEqual(["render failed", "promise failed"]);
      expect(capturedErrors().map((entry) => entry.source)).toEqual(["window", "unhandledrejection"]);

      stop();
      expect(target.listeners.size).toBe(0);
    } finally {
      consoleError.mockRestore();
      resetCapturedErrors();
    }
  });
});

describe("buildDiagnostics", () => {
  it("adds recent errors without document content", () => {
    const bundle: DiagnosticsBundle = {
      appVersion: "0.1.9",
      platform: "web",
      logs: ["telemetry=off"]
    };
    const report = buildDiagnostics(
      bundle,
      [{ at: 1, source: "window", kind: "TypeError", message: "Cannot read properties" }],
      new Date("2026-01-02T03:04:05.000Z")
    );

    expect(report.capturedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(report.appVersion).toBe("0.1.9");
    expect(report.recentErrors).toEqual([
      { at: 1, source: "window", kind: "TypeError", message: "Cannot read properties" }
    ]);
    expect(JSON.stringify(report)).not.toContain("body text");
  });
});
