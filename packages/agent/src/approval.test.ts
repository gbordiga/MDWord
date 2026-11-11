import { describe, expect, it } from "vitest";
import { jevDecisionRequest, parseJevVerdict, parseVerdict } from "./approval";

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

  it("reads one object after a short preamble and quotes an unreadable answer", () => {
    expect(parseVerdict('Sure! {"decision":"allow","reason":"ok"}')).toEqual({ decision: "allow", reason: "ok" });
    expect(parseVerdict("not json").reason).toBe("unreadable answer: not json");
    expect(parseVerdict("   ").reason).toBe("empty answer");
  });

  it("denies everything else", () => {
    for (const text of [
      "",
      "allow",
      "Sure! {\"decision\":\"allow\",\"reason\":\"ok\"} and {\"decision\":\"deny\",\"reason\":\"no\"}",
      '{"decision":"maybe","reason":"x"}',
      '{"decision":"allow"}',
      '{"decision":"allow","reason":"x","extra":1}',
      '{"decision":"allow","reason":' + JSON.stringify("x".repeat(300)) + " extra"
    ]) {
      expect(parseVerdict(text).decision, text).toBe("deny");
    }
  });
});

describe("Jev command check", () => {
  it("asks a choice with allow and deny criteria, and sends only the command", () => {
    const request = jevDecisionRequest({ command: "ls", shell: "bash", folder: "notes" });
    const questions = request.body.questions as { run: { type: string; criteria: Record<string, string> } };
    expect(request.url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(questions.run.type).toBe("choice");
    expect(questions.run.criteria.allow).toContain("inside the project");
    expect(questions.run.criteria.deny).toContain("not sure");
    expect(JSON.stringify(request.body.state)).toBe(JSON.stringify({ shell: "bash", folder: "notes", command: "ls" }));
  });

  it("allows only a confident allow", () => {
    expect(
      parseJevVerdict({
        answers: { run: { choice: "allow", probabilities: { allow: 0.91, deny: 0.09 } } },
        usage: { cost: 0.00002 }
      })
    ).toMatchObject({ decision: "allow", costUsd: 0.00002 });
    expect(
      parseJevVerdict({ answers: { run: { choice: "allow", probabilities: { allow: 0.55, deny: 0.45 } } } }).decision
    ).toBe("deny");
    expect(parseJevVerdict({ answers: { run: { choice: "deny", probabilities: { allow: 0.1, deny: 0.9 } } } }).reason).toBe(
      "allow 0.1, deny 0.9"
    );
  });
});
