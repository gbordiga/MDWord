import { describe, expect, it } from "vitest";
import { parseVerdict } from "./approval";

describe("parseVerdict", () => {
  it("accepts the exact object", () => {
    expect(parseVerdict('{"decision":"allow","reason":"reads a file"}')).toEqual({ decision: "allow", reason: "reads a file" });
    expect(parseVerdict(' {"decision":"deny","reason":"writes"} ')).toEqual({ decision: "deny", reason: "writes" });
  });

  it("accepts one markdown fence around the object", () => {
    expect(parseVerdict('```json\n{"decision":"allow","reason":"ok"}\n```')).toEqual({
      decision: "allow",
      reason: "ok"
    });
    expect(parseVerdict('```\n{"decision":"deny","reason":"writes"}\n```').decision).toBe("deny");
  });

  it("denies everything else", () => {
    for (const text of [
      "",
      "allow",
      "Sure! {\"decision\":\"allow\",\"reason\":\"ok\"}",
      '{"decision":"maybe","reason":"x"}',
      '{"decision":"allow"}',
      '{"decision":"allow","reason":"x","extra":1}',
      '{"decision":"allow","reason":' + JSON.stringify("x".repeat(300)) + "}"
    ]) {
      expect(parseVerdict(text).decision, text).toBe("deny");
    }
  });
});
